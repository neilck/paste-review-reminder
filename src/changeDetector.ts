import * as vscode from "vscode";
import { RegionManager } from "./regionManager";

interface DocumentChangeTracking {
  lastChangeTime: number;
  pendingChanges: vscode.TextDocumentContentChangeEvent[];
  timeout: NodeJS.Timeout | null;
}

export class ChangeDetector {
  private documentTracking: Map<string, DocumentChangeTracking> = new Map();
  private readonly DETECTION_WINDOW_MS = 100; // Time window to accumulate changes

  constructor(private regionManager: RegionManager) {
    console.log("[ChangeDetector] Initialized");
  }

  handleDocumentChange(
    document: vscode.TextDocument,
    event: vscode.TextDocumentChangeEvent
  ): void {
    console.log("[ChangeDetector] Document change detected:", {
      uri: document.uri
        .toString()
        .substring(document.uri.toString().lastIndexOf("/") + 1),
      changes: event.contentChanges.length,
    });

    const uri = document.uri.toString();
    const now = Date.now();

    // Initialize or get tracking data
    let tracking = this.documentTracking.get(uri);
    if (!tracking) {
      tracking = {
        lastChangeTime: now,
        pendingChanges: [],
        timeout: null,
      };
      this.documentTracking.set(uri, tracking);
    }

    // Add change to pending changes
    tracking.pendingChanges.push(...event.contentChanges);
    tracking.lastChangeTime = now;

    console.log(
      "[ChangeDetector] Pending changes:",
      tracking.pendingChanges.length
    );

    // Clear existing timeout and set new one
    if (tracking.timeout) {
      clearTimeout(tracking.timeout);
    }

    tracking.timeout = setTimeout(() => {
      this.analyzePendingChanges(document, uri);
    }, this.DETECTION_WINDOW_MS);
  }

  private analyzePendingChanges(
    document: vscode.TextDocument,
    uri: string
  ): void {
    console.log(
      "[ChangeDetector] Analyzing pending changes for:",
      uri.substring(uri.lastIndexOf("/") + 1)
    );

    const tracking = this.documentTracking.get(uri);
    if (!tracking || tracking.pendingChanges.length === 0) {
      console.log("[ChangeDetector] No pending changes to analyze");
      return;
    }

    const config = vscode.workspace.getConfiguration("pasteReviewReminder");
    const minimumLines = config.get<number>("minimumLines", 20);
    const charThreshold = config.get<number>("characterThreshold", 110);

    console.log("[ChangeDetector] Thresholds:", {
      minimumLines,
      charThreshold,
    });

    // Analyze each change
    for (const change of tracking.pendingChanges) {
      if (change.text.length === 0) {
        // Deletion, ignore
        console.log("[ChangeDetector] Skipping deletion");
        continue;
      }

      const lines = change.text.split("\n");
      const lineCount = lines.length;
      const charCount = change.text.length;

      // Calculate characters per second (using the detection window)
      const charsPerSecond = (charCount / this.DETECTION_WINDOW_MS) * 1000;

      console.log("[ChangeDetector] Change analysis:", {
        lineCount,
        charCount,
        charsPerSecond: Math.round(charsPerSecond),
        meetsLineThreshold: lineCount >= minimumLines,
        meetsSpeedThreshold: charsPerSecond >= charThreshold,
      });

      // Check if this looks like a paste or AI generation
      if (lineCount >= minimumLines && charsPerSecond >= charThreshold) {
        console.log("[ChangeDetector] ✅ TRIGGER! Creating review region");
        this.regionManager.addReviewRegion(
          document,
          change.range.start.line,
          lineCount
        );
      } else {
        console.log("[ChangeDetector] ❌ No trigger - thresholds not met");
      }
    }

    // Clear pending changes
    tracking.pendingChanges = [];
  }

  dispose(): void {
    for (const [uri, tracking] of this.documentTracking.entries()) {
      if (tracking.timeout) {
        clearTimeout(tracking.timeout);
      }
    }
    this.documentTracking.clear();
    console.log("[ChangeDetector] Disposed");
  }
}
