import * as vscode from "vscode";
import { RegionManager } from "./regionManager";
import { ChangeTracker } from "./changeTracker";
import { DecorationManager } from "./decorationManager";

let regionManager: RegionManager;
let changeTracker: ChangeTracker;
let decorationManager: DecorationManager;

export function activate(context: vscode.ExtensionContext): void {
  console.log("Paste Review Reminder extension activated");

  // Initialize managers
  regionManager = new RegionManager();
  changeTracker = new ChangeTracker(regionManager);
  decorationManager = new DecorationManager(regionManager);

  // Set up callback for when regions are created
  changeTracker.setOnRegionsCreated(() => {
    decorationManager.updateAllDecorations();
  });

  // Register event listeners
  registerEventListeners(context);

  // Update decorations for currently visible editors
  decorationManager.updateAllDecorations();

  // Register commands
  registerCommands(context);
}

function registerEventListeners(context: vscode.ExtensionContext): void {
  // Listen for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      handleTextDocumentChange(event);
    })
  );

  // Listen for cursor position changes
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      handleSelectionChange(event);
    })
  );

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        decorationManager.updateDecorations(editor);
      }
    })
  );

  // Listen for visible editors changes
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => {
      decorationManager.updateAllDecorations();
    })
  );

  // Listen for document close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      changeTracker.stopTracking(document.uri);
      regionManager.clearDocument(document.uri);
    })
  );
}

/**
 * Handle text document changes
 * IMPORTANT: Process region removal BEFORE tracking new changes
 */
function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  const document = event.document;

  console.log("handleTextDocumentChange called.");

  // STEP 1: Remove lines from regions for modifications/deletions
  // This must happen BEFORE tracking new changes
  let regionsModified = false;
  for (const change of event.contentChanges) {
    // For any change (addition, deletion, or modification), remove affected lines from regions
    // This handles both line modifications and deletions
    const wasModified = regionManager.removeLinesFromRegions(
      document.uri,
      change.range
    );
    if (wasModified) {
      regionsModified = true;
    }

    // Update region line numbers if lines were added/removed
    regionManager.updateRegionsAfterEdit(
      document.uri,
      change.range,
      change.rangeLength,
      change.text
    );
  }

  // STEP 2: Track changes for potential new regions
  // This happens AFTER region removal to avoid immediate deletion
  changeTracker.processChange(event);

  // STEP 3: Update decorations if regions were modified
  if (regionsModified) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === document) {
      decorationManager.updateDecorations(editor);
    }
  }

  // Note: New regions from tracking will be created after the timeout,
  // and decorations will be updated via the callback mechanism
}

/**
 * Handle cursor selection changes
 * Remove lines from regions when cursor moves to them
 */
function handleSelectionChange(
  event: vscode.TextEditorSelectionChangeEvent
): void {
  const editor = event.textEditor;
  const document = editor.document;

  let regionsModified = false;

  for (const selection of event.selections) {
    // Create a range for the line(s) the cursor is on
    const range = new vscode.Range(
      selection.start.line,
      0,
      selection.end.line,
      Number.MAX_SAFE_INTEGER
    );

    const wasModified = regionManager.removeLinesFromRegions(
      document.uri,
      range
    );
    if (wasModified) {
      regionsModified = true;
    }
  }

  if (regionsModified) {
    decorationManager.updateDecorations(editor);
  }
}

function registerCommands(context: vscode.ExtensionContext): void {
  // Register dismiss command (for future CodeLens integration)
  context.subscriptions.push(
    vscode.commands.registerCommand("pasteReviewReminder.dismissRegion", () => {
      // This will be implemented when CodeLens is added
      vscode.window.showInformationMessage(
        "Region dismiss feature coming soon!"
      );
    })
  );
}

export function deactivate(): void {
  changeTracker?.clearAll();
  regionManager?.clearAll();
  decorationManager?.dispose();
}
