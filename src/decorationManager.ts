import * as vscode from "vscode";
import type { RegionManager } from "./regionManager";

/**
 * Manages decorations (highlighting) for pasted or AI-generated code regions
 */
export class DecorationManager {
  private decorationType: vscode.TextEditorDecorationType;

  constructor(private regionManager: RegionManager) {
    this.decorationType = this.createDecorationType();

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("pasteReviewReminder.highlightColor")) {
        this.decorationType.dispose();
        this.decorationType = this.createDecorationType();
        this.updateAllDecorations();
      }
    });
  }

  /**
   * Create the decoration type with user-configured color
   */
  private createDecorationType(): vscode.TextEditorDecorationType {
    const config = vscode.workspace.getConfiguration("pasteReviewReminder");
    const highlightColor = config.get<string>(
      "highlightColor",
      "rgba(255, 200, 100, 0.15)"
    );

    return vscode.window.createTextEditorDecorationType({
      backgroundColor: highlightColor,
      overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      isWholeLine: true,
    });
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
        Number.MAX_SAFE_INTEGER // End of line
      );

      decorations.push({
        range,
        hoverMessage: "Pasted or AI-generated code - please review",
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * Update decorations for all visible editors
   */
  public updateAllDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  /**
   * Clear decorations for a specific editor
   */
  public clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorationType, []);
  }

  /**
   * Dispose of the decoration type
   */
  public dispose(): void {
    this.decorationType.dispose();
  }
}
