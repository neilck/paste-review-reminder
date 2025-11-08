import * as vscode from "vscode";
import { HighlightRegion } from "./regionTypes";

export class RegionDecorator {
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(255, 215, 0, 0.25)",
      overviewRulerColor: "rgba(255, 215, 0, 0.8)",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  }

  update(editor: vscode.TextEditor, regions: HighlightRegion[]) {
    editor.setDecorations(
      this.decorationType,
      regions.map((r) => r.range)
    );
  }

  clear(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorationType, []);
  }

  dispose() {
    this.decorationType.dispose();
  }
}
