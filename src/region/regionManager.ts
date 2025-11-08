import * as vscode from "vscode";
import { RegionStorage } from "./regionStorage";
import { RegionDecorator } from "./regionDecorator";
import { RegionCodeLensProvider } from "./regionCodeLensProvider";
import { HighlightRegion } from "./regionTypes";

export class RegionManager {
  private regions: HighlightRegion[] = [];
  private storage: RegionStorage;
  private decorator: RegionDecorator;
  private codeLensProvider: RegionCodeLensProvider;

  constructor(private context: vscode.ExtensionContext) {
    this.storage = new RegionStorage(context);
    this.decorator = new RegionDecorator();
    this.codeLensProvider = new RegionCodeLensProvider();
  }

  restoreHighlights() {
    this.regions = this.storage.load();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.decorator.update(editor, this.regions);
    }
  }

  async addRegion(editor: vscode.TextEditor, range: vscode.Range) {
    const id = crypto.randomUUID();
    this.regions.push({ range, id });
    this.decorator.update(editor, this.regions);
    this.codeLensProvider.setRegions(this.regions);
    await this.storage.save(this.regions);
  }

  async dismissRegionAtPosition(
    editor: vscode.TextEditor,
    position: vscode.Position
  ) {
    const before = this.regions.length;
    this.regions = this.regions.filter((r) => !r.range.contains(position));
    if (this.regions.length < before) {
      this.decorator.update(editor, this.regions);
      this.codeLensProvider.setRegions(this.regions);
      await this.storage.save(this.regions);
      vscode.window.showInformationMessage("Highlight dismissed.");
    }
  }

  async dismissAllRegions(editor: vscode.TextEditor) {
    if (this.regions.length === 0) {
      vscode.window.showInformationMessage("No highlights to dismiss.");
      return;
    }

    this.regions = [];
    this.decorator.clear(editor);
    this.codeLensProvider.setRegions([]);
    await this.storage.save([]);
    vscode.window.showInformationMessage("All highlights dismissed.");
  }

  checkCursorAndDismiss(editor: vscode.TextEditor, position: vscode.Position) {
    const match = this.regions.find((r) => r.range.contains(position));
    if (match) {
      this.dismissRegionAtPosition(editor, position);
    }
  }

  provideCodeLenses(document: vscode.TextDocument) {
    return this.codeLensProvider.provideCodeLenses(document);
  }

  dispose() {
    this.decorator.dispose();
  }
}
