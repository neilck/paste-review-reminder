import * as vscode from "vscode";
import { ChangeDetector } from "./changeDetector";
import { RegionManager } from "./region";

export function activate(context: vscode.ExtensionContext) {
  console.log("Paste Review Reminder extension is now active");

  const regionManager = new RegionManager(context);
  const changeDetector = new ChangeDetector(regionManager);
  context.subscriptions.push(changeDetector);

  // Restore highlights from previous session
  regionManager.restoreHighlights();

  // Listen for document changes (optional: integrate ChangeDetector here)
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      changeDetector.handleDocumentChange(event.document, event);
    }
  );
  context.subscriptions.push(documentChangeListener);

  // Auto-dismiss when cursor moves into a region
  const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(
    (event) => {
      if (event.selections.length > 0) {
        const position = event.selections[0].active;
        regionManager.checkCursorAndDismiss(event.textEditor, position);
      }
    }
  );

  // Register dismiss single region command (via CodeLens)
  const dismissRegionCommand = vscode.commands.registerCommand(
    "pasteReviewReminder.dismissRegion",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const position = editor.selection.active;
      await regionManager.dismissRegionAtPosition(editor, position);
    }
  );

  // Register dismiss all regions command (global CodeLens)
  const dismissAllCommand = vscode.commands.registerCommand(
    "pasteReviewReminder.dismissAllRegions",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      await regionManager.dismissAllRegions(editor);
    }
  );

  // Register CodeLens provider
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { scheme: "file" },
    {
      provideCodeLenses(document: vscode.TextDocument) {
        return regionManager.provideCodeLenses(document);
      },
    }
  );

  // Add subscriptions to dispose when extension is deactivated
  context.subscriptions.push(
    documentChangeListener,
    selectionChangeListener,
    dismissRegionCommand,
    dismissAllCommand,
    codeLensProvider,
    regionManager
  );
}

export function deactivate() {
  console.log("Paste Review Reminder extension deactivated");
}
