import * as vscode from "vscode";
import { RegionManager } from "./regionManager";

/**
 * Provides CodeLens actions for dismissing review regions
 */
export class RegionCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private regionManager: RegionManager) {
    // Subscribe to region changes to trigger CodeLens refresh
    regionManager.onDidChangeRegions(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Provide CodeLens for all regions in the document
   */
  public provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const regions = this.regionManager.getRegions(document.uri);
    const codeLenses: vscode.CodeLens[] = [];

    for (const region of regions) {
      const range = new vscode.Range(region.startLine, 0, region.startLine, 0);

      // "Dismiss review" CodeLens
      const dismissCommand: vscode.Command = {
        title: "✓ Dismiss review",
        command: "pasteReviewReminder.dismissRegion",
        arguments: [document.uri, region.id],
      };
      codeLenses.push(new vscode.CodeLens(range, dismissCommand));

      // "Dismiss all" CodeLens
      const dismissAllCommand: vscode.Command = {
        title: "✓ Dismiss all",
        command: "pasteReviewReminder.dismissAll",
        arguments: [document.uri],
      };
      codeLenses.push(new vscode.CodeLens(range, dismissAllCommand));
    }

    return codeLenses;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}
