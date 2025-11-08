import * as vscode from "vscode";
import { HighlightRegion } from "./regionTypes";

export class RegionStorage {
  constructor(private context: vscode.ExtensionContext) {}

  async save(regions: HighlightRegion[]) {
    const data = regions.map((r) => ({
      start: r.range.start,
      end: r.range.end,
      id: r.id,
    }));
    await this.context.workspaceState.update("pasteReviewRegions", data);
  }

  load(): HighlightRegion[] {
    const stored = this.context.workspaceState.get<any[]>("pasteReviewRegions");
    if (!stored) return [];
    return stored.map(
      (r) =>
        ({
          range: new vscode.Range(
            new vscode.Position(r.start.line, r.start.character),
            new vscode.Position(r.end.line, r.end.character)
          ),
          id: r.id,
        } as HighlightRegion)
    );
  }

  clear() {
    this.context.workspaceState.update("pasteReviewRegions", []);
  }
}
