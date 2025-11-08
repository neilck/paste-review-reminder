import * as vscode from "vscode";
import { HighlightRegion } from "./regionTypes";

export class RegionCodeLensProvider implements vscode.CodeLensProvider {
  private regions: HighlightRegion[] = [];

  setRegions(regions: HighlightRegion[]) {
    this.regions = regions;
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];

    lenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: "Dismiss All Highlights",
        command: "pasteReviewReminder.dismissAllRegions",
      })
    );

    for (const region of this.regions) {
      lenses.push(
        new vscode.CodeLens(region.range, {
          title: "Dismiss Highlight",
          command: "pasteReviewReminder.dismissRegion",
        })
      );
    }

    return lenses;
  }
}
