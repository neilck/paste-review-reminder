// src/managers/shadowTextManager.ts

import * as vscode from "vscode";

/**
 * Manages an in-memory "shadow" copy of open text documents.
 *
 * The primary purpose is to provide the state of a document *before* a change event occurred.
 * The standard `onDidChangeTextDocument` event provides the document state *after* the change,
 * making it impossible to diff against the previous state without a mechanism like this.
 */
export class ShadowTextManager implements vscode.Disposable {
  private readonly shadowDocs: Map<string, string> = new Map();

  constructor() {
    // On activation, immediately create shadows for any documents that are already open.
    vscode.workspace.textDocuments.forEach((doc) => {
      this.shadowDocs.set(doc.uri.toString(), doc.getText());
    });
  }

  /**
   * Registers a newly opened document and creates its shadow copy.
   */
  public onDidOpenTextDocument(doc: vscode.TextDocument): void {
    this.shadowDocs.set(doc.uri.toString(), doc.getText());
  }

  /**
   * Removes the shadow copy of a closed document to free up memory.
   */
  public onDidCloseTextDocument(doc: vscode.TextDocument): void {
    this.shadowDocs.delete(doc.uri.toString());
  }

  /**
   * Processes a document change event to update the shadow copy and return the previous state.
   *
   * This is the core method. It performs two key actions:
   * 1. Retrieves the text that existed *before* the current change event (the "old text").
   * 2. Updates the shadow with the document's *new* text, preparing it for the *next* change event.
   *
   * @param event The `TextDocumentChangeEvent` from the VS Code API.
   * @returns The string content of the document as it was *before* this change, or `undefined` if no shadow existed.
   */
  public getOldTextAndRefreshShadow(
    event: vscode.TextDocumentChangeEvent
  ): string | undefined {
    const uriString = event.document.uri.toString();
    const oldText = this.shadowDocs.get(uriString);

    // The most reliable way to get the new state is from the document object itself,
    // which reflects the state *after* the change. This avoids complex and error-prone
    // manual text reconstruction.
    const newText = event.document.getText();
    this.shadowDocs.set(uriString, newText);

    return oldText;
  }

  /**
   * Updates the URI key for a shadow copy when a file is renamed.
   */
  public updateDocumentUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    const oldKey = oldUri.toString();
    const newKey = newUri.toString();
    const shadow = this.shadowDocs.get(oldKey);

    if (shadow) {
      this.shadowDocs.set(newKey, shadow);
      this.shadowDocs.delete(oldKey);
    }
  }

  /**
   * Clears all shadow documents from memory. Called on extension deactivation.
   */
  public clearAll(): void {
    this.shadowDocs.clear();
  }

  /**
   * Implements the Disposable interface to ensure cleanup.
   */
  public dispose(): void {
    this.clearAll();
  }
}
