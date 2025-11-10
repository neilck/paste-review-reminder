import * as vscode from "vscode";
import { RegionManager } from "./regionManager";
import { SaveManager } from "./saveManager";
import { ChangeTracker } from "./changeTracker";
import { DecorationManager } from "./decorationManager";
import { RegionCodeLensProvider } from "./codeLensProvider";

let regionManager: RegionManager;
let saveManager: SaveManager;
let changeTracker: ChangeTracker;
let decorationManager: DecorationManager;
let codeLensProvider: RegionCodeLensProvider;

export function activate(context: vscode.ExtensionContext): void {
  console.log("Paste Review Reminder extension activated");

  // Initialize managers
  regionManager = new RegionManager();
  saveManager = new SaveManager(context);
  changeTracker = new ChangeTracker(regionManager);
  decorationManager = new DecorationManager(regionManager);
  codeLensProvider = new RegionCodeLensProvider(regionManager);

  // Register CodeLens provider for all file types
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      codeLensProvider
    )
  );

  // Register event listeners
  registerEventListeners(context);

  // --- Handle already open documents ---
  for (const editor of vscode.window.visibleTextEditors) {
    const document = editor.document;

    const savedRegions = saveManager.getRegions(document.uri);
    if (savedRegions && savedRegions.length > 0) {
      regionManager.restoreRegionsForDocument(document.uri, savedRegions);
    }
  }

  // Update decorations for currently visible editors
  decorationManager.updateAllDecorations();

  // Register commands
  registerCommands(context);
}

function registerEventListeners(context: vscode.ExtensionContext): void {
  // Listen for document opens
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      handleDocumentOpen(document);
    })
  );

  // Listen for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      handleTextDocumentChange(event);
    })
  );

  // Listen for document saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      handleDocumentSave(document);
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

  // Listen for file rename (before it happens)
  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async (event) => {
      for (const file of event.files) {
        const { oldUri, newUri } = file;
        // Update both runtime state and saved manifest
        regionManager.updateDocumentUri(oldUri, newUri);
        saveManager.updateFilePath(oldUri, newUri);
      }
    })
  );
}

/**
 * Handle a document being opened.
 * Load saved regions if checksum matches, otherwise clear regions and update manifest.
 */
function handleDocumentOpen(document: vscode.TextDocument): void {
  const savedRegions = saveManager.getRegions(document.uri);

  if (!savedRegions || savedRegions.length === 0) {
    return;
  }

  // Validate checksum
  const content = document.getText();
  const matches = saveManager.hasMatchingChecksum(document.uri, content);

  if (matches) {
    // Restore regions without firing events (this is a load operation)
    regionManager.restoreRegionsForDocument(document.uri, savedRegions);
    // Manually update decorations since restore doesn't fire event
    const editors = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === document.uri.toString()
    );
    for (const editor of editors) {
      decorationManager.updateDecorations(editor);
    }
  } else {
    // Checksum mismatch → remove regions immediately
    regionManager.clearDocument(document.uri);
    // Save manifest immediately to reflect removal
    saveManager.saveFileRegions(document.uri, []);
  }
}

/**
 * Handle document being saved.
 * Save current regions for that file to the manifest.
 */
function handleDocumentSave(document: vscode.TextDocument): void {
  const regions = regionManager.getRegions(document.uri);
  saveManager.saveFileRegions(document.uri, regions);
}

/**
 * Handle text document changes
 * IMPORTANT: Process region removal BEFORE tracking new changes
 */
function handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
  const document = event.document;

  // STEP 1: Remove lines from regions for modifications/deletions
  // This must happen BEFORE tracking new changes
  for (const change of event.contentChanges) {
    // For any change (addition, deletion, or modification), remove affected lines from regions
    // This handles both line modifications and deletions
    regionManager.removeLinesFromRegions(document.uri, change.range);

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

  // Note: Decorations are automatically updated via regionManager events
  // New regions from tracking will be created after the timeout,
  // and decorations will be updated via the event mechanism
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

  for (const selection of event.selections) {
    const selectionLineCount = selection.end.line - selection.start.line + 1;
    const isEntireDocument =
      selection.start.line === 0 &&
      selection.end.line === document.lineCount - 1;

    // Ignore very large selections (like Select All)
    // Skip if: entire document
    if (isEntireDocument) {
      continue;
    }

    // Create a range for the line(s) the cursor is on
    const range = new vscode.Range(
      selection.start.line,
      0,
      selection.end.line,
      Number.MAX_SAFE_INTEGER
    );

    regionManager.removeLinesFromRegions(document.uri, range);
  }

  // Note: Decorations are automatically updated via regionManager events
}

function registerCommands(context: vscode.ExtensionContext): void {
  // Register dismiss region command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pasteReviewReminder.dismissRegion",
      (documentUri: vscode.Uri, regionId: string) => {
        dismissRegion(documentUri, regionId);
      }
    )
  );

  // Register dismiss all command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pasteReviewReminder.dismissAll",
      (documentUri: vscode.Uri) => {
        dismissAllRegions(documentUri);
      }
    )
  );
}

/**
 * Dismiss a specific region
 */
function dismissRegion(documentUri: vscode.Uri, regionId: string): void {
  const regions = regionManager.getRegions(documentUri);
  const filteredRegions = regions.filter((r) => r.id !== regionId);

  // Update regions (this will fire event and update decorations automatically)
  regionManager.setRegionsForDocument(documentUri, filteredRegions);

  // Save to manifest
  saveManager.saveFileRegions(documentUri, filteredRegions);
}

/**
 * Dismiss all regions for a document
 */
function dismissAllRegions(documentUri: vscode.Uri): void {
  // Clear all regions (this will fire event and update decorations automatically)
  regionManager.clearDocument(documentUri);

  // Save empty regions to manifest
  saveManager.saveFileRegions(documentUri, []);
}

export function deactivate(): void {
  changeTracker?.clearAll();
  regionManager?.clearAll();
  regionManager?.dispose();
  decorationManager?.dispose();
  codeLensProvider?.dispose();
}
