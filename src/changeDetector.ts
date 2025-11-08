import * as vscode from "vscode";
import { RegionManager } from "./region";

interface DocumentTracking {
  lastChangeTime: number;
  pendingChanges: vscode.TextDocumentContentChangeEvent[];
  timeout: NodeJS.Timeout | null;
}

export class ChangeDetector {
  private documentTracking: Map<string, DocumentTracking> = new Map();
  private readonly DETECTION_WINDOW_MS = 100; // Time window to accumulate changes

  constructor(private regionManager: RegionManager) {
    console.log("[ChangeDetector] Initialized");
  }

  handleDocumentChange(
    document: vscode.TextDocument,
    event: vscode.TextDocumentChangeEvent
  ): void {
    const uri = document.uri.toString();
    const now = Date.now();

    let tracking = this.documentTracking.get(uri);
    if (!tracking) {
      tracking = { lastChangeTime: now, pendingChanges: [], timeout: null };
      this.documentTracking.set(uri, tracking);
    }

    tracking.pendingChanges.push(...event.contentChanges);
    tracking.lastChangeTime = now;

    // Reset timeout
    if (tracking.timeout) clearTimeout(tracking.timeout);

    tracking.timeout = setTimeout(() => {
      this.analyzePendingChanges(document, uri);
    }, this.DETECTION_WINDOW_MS);
  }

  private async analyzePendingChanges(
    document: vscode.TextDocument,
    uri: string
  ) {
    const tracking = this.documentTracking.get(uri);
    if (!tracking || tracking.pendingChanges.length === 0) return;

    const config = vscode.workspace.getConfiguration("pasteReviewReminder");
    const minimumLines = config.get<number>("minimumLines", 20);
    const charThreshold = config.get<number>("characterThreshold", 110);

    for (const change of tracking.pendingChanges) {
      const lines = change.text.split("\n");
      const lineCount = lines.length;
      const charCount = change.text.length;
      const charsPerSecond = (charCount / this.DETECTION_WINDOW_MS) * 1000;

      // Trigger new region for large paste / fast insert
      if (lineCount >= minimumLines && charsPerSecond >= charThreshold) {
        const editor = vscode.window.visibleTextEditors.find(
          (e) => e.document.uri.toString() === uri
        );
        if (editor) {
          const startLine = change.range.start.line;
          await this.regionManager.addRegion(
            editor,
            new vscode.Range(
              startLine,
              0,
              startLine + lineCount - 1,
              Number.MAX_SAFE_INTEGER
            )
          );
        }
      }

      // Handle deletions or pastes over existing regions
      if (change.rangeLength > 0 && change.text.length === 0) {
        const editor = vscode.window.visibleTextEditors.find(
          (e) => e.document.uri.toString() === uri
        );
        if (editor) {
          const start = change.range.start.line;
          const end = change.range.end.line;
          for (let i = start; i <= end; i++) {
            this.regionManager.checkCursorAndDismiss(
              editor,
              new vscode.Position(i, 0)
            );
          }
        }
      }
    }

    tracking.pendingChanges = [];
  }

  dispose() {
    for (const t of this.documentTracking.values()) {
      if (t.timeout) clearTimeout(t.timeout);
    }
    this.documentTracking.clear();
    console.log("[ChangeDetector] Disposed");
  }
}
