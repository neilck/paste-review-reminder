import * as vscode from "vscode";

export interface HighlightRegion {
  range: vscode.Range;
  id: string;
}
