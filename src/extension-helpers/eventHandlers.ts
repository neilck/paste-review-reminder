// src/extension-helpers/eventHandlers.ts

import * as vscode from "vscode";
import type { SaveScheduler } from "./saveScheduler";
import type { RegionManager } from "../regionManager";
import type { SaveManager } from "../saveManager";
import type { ChangeTracker } from "../changeTracker";
import type { DecorationManager } from "../decorationManager";
import type { ShadowTextManager } from "./shadowTextManager"; // [NEW] Import the new manager

/**
 * Registers and handles all document and editor events
 */
export function registerEventHandlers(
  context: vscode.ExtensionContext,
  regionManager: RegionManager,
  saveManager: SaveManager,
  changeTracker: ChangeTracker,
  decorationManager: DecorationManager,
  saveScheduler: SaveScheduler,
  shadowTextManager: ShadowTextManager
): void {
  // Listen for document opens
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      // [UPDATED] Pass shadowTextManager to the handler
      handleDocumentOpen(
        document,
        regionManager,
        saveManager,
        decorationManager,
        saveScheduler,
        shadowTextManager
      );
    })
  );

  // Listen for text document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      // [UPDATED] Pass shadowTextManager to the handler
      handleTextDocumentChange(
        event,
        regionManager,
        changeTracker,
        saveScheduler,
        shadowTextManager
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
      // [UPDATED] Pass shadowTextManager to the handler
      handleDocumentClose(
        document,
        changeTracker,
        regionManager,
        saveScheduler,
        shadowTextManager
      );
    })
  );

  // Listen for file rename (before it happens)
  context.subscriptions.push(
    vscode.workspace.onWillRenameFiles(async (event) => {
      // [UPDATED] Pass shadowTextManager to the handler
      handleFileRename(
        event,
        regionManager,
        saveManager,
        saveScheduler,
        shadowTextManager
      );
    })
  );
}

/**
 * Handle a document being opened.
 * Load saved regions if checksum matches, otherwise clear regions and update manifest.
 * Also, ensure the shadow text manager is aware of the opened document.
 */
function handleDocumentOpen(
  document: vscode.TextDocument,
  regionManager: RegionManager,
  saveManager: SaveManager,
  decorationManager: DecorationManager,
  saveScheduler: SaveScheduler,
  shadowTextManager: ShadowTextManager // [NEW] Accept manager
): void {
  // [NEW] Inform the shadow manager that a document has been opened.
  shadowTextManager.onDidOpenTextDocument(document);

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
    regionManager.clearDocument(document.uri);
    saveScheduler.scheduleSave(document.uri, true);
  }
}

/**
 * Handle document being saved.
 */
function handleDocumentSave(
  document: vscode.TextDocument,
  saveScheduler: SaveScheduler
): void {
  saveScheduler.scheduleSave(document.uri, true);
}

/**
 * Handle text document changes
 */
function handleTextDocumentChange(
  event: vscode.TextDocumentChangeEvent,
  regionManager: RegionManager,
  changeTracker: ChangeTracker,
  saveScheduler: SaveScheduler,
  shadowTextManager: ShadowTextManager
): void {
  const document = event.document;

  // Step 1: Capture the state of the document and regions *before* any changes are processed.
  const oldText = shadowTextManager.getOldTextAndRefreshShadow(event);
  const oldRegions = regionManager.getRegions(document.uri); // Snapshot the regions!

  // Step 2: Process region modifications/deletions based on the change's range.
  // This correctly handles the "deletion" part of a replacement paste first.
  let regionsModified = false;
  for (const change of event.contentChanges) {
    const wasModified = regionManager.removeLinesFromRegions(
      document.uri,
      change.range
    );
    if (wasModified) {
      regionsModified = true;
    }

    regionManager.updateRegionsAfterEdit(
      document.uri,
      change.range,
      change.rangeLength,
      change.text
    );
  }

  // Step 3: Track changes for potential new regions, passing the "before" state snapshots.
  // This correctly handles the "insertion" part of a replacement paste.
  changeTracker.processChange(event, oldText, oldRegions); // Pass the snapshotted oldRegions

  // Step 4: Schedule a debounced save if regions were modified by the deletion step.
  if (regionsModified) {
    saveScheduler.scheduleSave(document.uri, false);
  }
}

/**
 * Handle cursor selection changes
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
    // Ignore very large selections (like Select All)
    if (
      selection.start.line === 0 &&
      selection.end.line >= document.lineCount - 2
    ) {
      continue;
    }

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
}

/**
 * Handle document close
 */
function handleDocumentClose(
  document: vscode.TextDocument,
  changeTracker: ChangeTracker,
  regionManager: RegionManager,
  saveScheduler: SaveScheduler,
  shadowTextManager: ShadowTextManager // [NEW] Accept manager
): void {
  // Inform the shadow manager to clean up the closed document.
  shadowTextManager.onDidCloseTextDocument(document);

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
  saveScheduler: SaveScheduler,
  shadowTextManager: ShadowTextManager
): void {
  for (const file of event.files) {
    const { oldUri, newUri } = file;
    shadowTextManager.updateDocumentUri(oldUri, newUri);

    regionManager.updateDocumentUri(oldUri, newUri);
    saveManager.updateFilePath(oldUri, newUri);
    // Save immediately after rename
    saveScheduler.scheduleSave(newUri, true);
  }
}
