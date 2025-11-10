import * as vscode from "vscode";
import { RegionManager } from "./regionManager";

/**
 * Manages decorations for review regions
 * Automatically updates decorations when regions change via events
 */
export class DecorationManager {
  private decorationType: vscode.TextEditorDecorationType;

  constructor(private regionManager: RegionManager) {
    // Create decoration type for review regions
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 200, 0, 0.1)",
      isWholeLine: true,
      overviewRulerColor: "rgba(255, 200, 0, 0.8)",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });

    // Subscribe to region changes
    regionManager.onDidChangeRegions((uri) => {
      this.updateDecorationsForDocument(uri);
    });
  }

  /**
   * Update decorations for all visible editors displaying the given document
   */
  private updateDecorationsForDocument(documentUri: vscode.Uri): void {
    const uriString = documentUri.toString();
    const editors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === uriString
    );

    for (const editor of editors) {
      this.updateDecorations(editor);
    }
  }

  /**
   * Update decorations for a specific editor
   */
  public updateDecorations(editor: vscode.TextEditor): void {
    const regions = this.regionManager.getRegions(editor.document.uri);
    const decorations: vscode.DecorationOptions[] = [];

    for (const region of regions) {
      const range = new vscode.Range(
        region.startLine,
        0,
        region.endLine,
        Number.MAX_SAFE_INTEGER
      );

      decorations.push({
        range,
        hoverMessage: "Review this pasted or AI-generated code",
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * Update decorations for all visible editors
   * Used during activation for already-open documents
   */
  public updateAllDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.decorationType.dispose();
  }
}
