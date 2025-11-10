import * as vscode from "vscode";
import type { SaveScheduler } from "./saveScheduler";
import type { RegionManager } from "../regionManager";
import type { SaveManager } from "../saveManager";
import type { ChangeTracker } from "../changeTracker";
import type { DecorationManager } from "../decorationManager";

/**
 * Registers and handles all document and editor events
 */
export function registerEventHandlers(
  context: vscode.ExtensionContext,
  regionManager: RegionManager,
  saveManager: SaveManager,
  changeTracker: ChangeTracker,
  decorationManager: DecorationManager,
  saveScheduler: SaveScheduler
): void {
  // Listen for document opens
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      handleDocumentOpen(
        document,
        regionManager,
        saveManager,
        decorationManager,
        saveScheduler
      );
    })
  );

  // Listen for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      handleTextDocumentChange(
        event,
        regionManager,
        changeTracker,
        saveScheduler
      );
    })
  );

  // Listen for document saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      handleDocumentSave(document, saveScheduler);
    })
  );

  // Listen for cursor position changes
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      handleSelectionChange(event, regionManager, saveScheduler);
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
      handleDocumentClose(
        document,
        changeTracker,
        regionManager,
        saveScheduler
      );
    })
  );

  // Listen for file rename (before it happens)
  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async (event) => {
      handleFileRename(event, regionManager, saveManager, saveScheduler);
    })
  );
}

/**
 * Handle a document being opened.
 * Load saved regions if checksum matches, otherwise clear regions and update manifest.
 */
function handleDocumentOpen(
  document: vscode.TextDocument,
  regionManager: RegionManager,
  saveManager: SaveManager,
  decorationManager: DecorationManager,
  saveScheduler: SaveScheduler
): void {
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
    saveScheduler.scheduleSave(document.uri, true);
  }
}

/**
 * Handle document being saved.
 * Save current regions for that file to the manifest immediately.
 */
function handleDocumentSave(
  document: vscode.TextDocument,
  saveScheduler: SaveScheduler
): void {
  saveScheduler.scheduleSave(document.uri, true);
}

/**
 * Handle text document changes
 * IMPORTANT: Process region removal BEFORE tracking new changes
 */
function handleTextDocumentChange(
  event: vscode.TextDocumentChangeEvent,
  regionManager: RegionManager,
  changeTracker: ChangeTracker,
  saveScheduler: SaveScheduler
): void {
  const document = event.document;

  let regionsModified = false;

  // STEP 1: Remove lines from regions for modifications/deletions
  // This must happen BEFORE tracking new changes
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

  // STEP 3: Schedule debounced save if regions were modified
  if (regionsModified) {
    saveScheduler.scheduleSave(document.uri, false);
  }

  // Note: Decorations are automatically updated via regionManager events
  // New regions from tracking will be created after the timeout,
  // and decorations will be updated via the event mechanism
}

/**
 * Handle cursor selection changes
 * Remove lines from regions when cursor moves to them
 */
function handleSelectionChange(
  event: vscode.TextEditorSelectionChangeEvent,
  regionManager: RegionManager,
  saveScheduler: SaveScheduler
): void {
  const editor = event.textEditor;
  const document = editor.document;

  let regionsModified = false;

  for (const selection of event.selections) {
    const selectionLineCount = selection.end.line - selection.start.line + 1;
    const isEntireDocument =
      selection.start.line === 0 &&
      selection.end.line === document.lineCount - 1;

    // Ignore very large selections (like Select All)
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

    const wasModified = regionManager.removeLinesFromRegions(
      document.uri,
      range
    );
    if (wasModified) {
      regionsModified = true;
    }
  }

  // Schedule debounced save if regions were modified
  if (regionsModified) {
    saveScheduler.scheduleSave(document.uri, false);
  }

  // Note: Decorations are automatically updated via regionManager events
}

/**
 * Handle document close
 */
function handleDocumentClose(
  document: vscode.TextDocument,
  changeTracker: ChangeTracker,
  regionManager: RegionManager,
  saveScheduler: SaveScheduler
): void {
  changeTracker.stopTracking(document.uri);
  regionManager.clearDocument(document.uri);
  saveScheduler.clearTimer(document.uri);
}

/**
 * Handle file rename
 */
function handleFileRename(
  event: vscode.FileWillRenameEvent,
  regionManager: RegionManager,
  saveManager: SaveManager,
  saveScheduler: SaveScheduler
): void {
  for (const file of event.files) {
    const { oldUri, newUri } = file;
    // Update both runtime state and saved manifest
    regionManager.updateDocumentUri(oldUri, newUri);
    saveManager.updateFilePath(oldUri, newUri);
    // Save immediately after rename
    saveScheduler.scheduleSave(newUri, true);
  }
}
