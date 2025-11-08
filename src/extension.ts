import * as vscode from "vscode";
import { RegionManager } from "./regionManager";
import { ChangeDetector } from "./changeDetector";

export function activate(context: vscode.ExtensionContext) {
  console.log("Paste Review Reminder extension is now active");

  const regionManager = new RegionManager();
  const changeDetector = new ChangeDetector(regionManager);

  // Monitor document changes
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      changeDetector.handleDocumentChange(event.document, event);
    }
  );

  // Register dismiss command
  const dismissCommand = vscode.commands.registerCommand(
    "pasteReviewReminder.dismissRegion",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const position = editor.selection.active;
      await regionManager.dismissRegionAtPosition(editor, position);
    }
  );

  // Register CodeLens provider for dismiss action
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { scheme: "file" },
    {
      provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        return regionManager.provideCodeLenses(document);
      },
    }
  );

  context.subscriptions.push(
    documentChangeListener,
    dismissCommand,
    codeLensProvider,
    regionManager
  );
}

export function deactivate() {
  console.log("Paste Review Reminder extension deactivated");
}
