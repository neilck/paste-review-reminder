// src/changeTracker.ts

import * as vscode from "vscode";
import { Region } from "./types";
import type { ChangeTrackingState } from "./types";
import type { RegionManager } from "./regionManager";
import { ENABLE_REVIEWED_PASTE_CHECK } from "./extension-helpers/eventHandlers"; // [NEW] Import the feature flag
import { start } from "repl";

const TRACKING_TIMEOUT = 100; // milliseconds

// Helper function to generate the contextual key
function getContextualKey(lines: string[], index: number): string {
  const lineContent = lines[index];

  // Define the window size for context. 5 lines above and 5 below.
  const contextWindow = 5;

  // Get the 'above' context, handling the top-of-file boundary case
  const aboveStart = Math.max(0, index - contextWindow);
  const aboveLines = lines.slice(aboveStart, index);
  const aboveContext = aboveLines.join("\n");

  // Get the 'below' context, handling the end-of-file boundary case
  const belowEnd = Math.min(lines.length, index + 1 + contextWindow);
  const belowLines = lines.slice(index + 1, belowEnd);
  const belowContext = belowLines.join("\n");

  // Using character count as you suggested is fast and effective.
  const aboveHash = aboveContext.length;
  const belowHash = belowContext.length;

  return `${lineContent}-${aboveHash}-${belowHash}`;
}

/**
 * Tracks text changes to detect pasted or AI-generated code
 * Two detection paths:
 * 1. Immediate paste detection (>minimumPasteLines in single change)
 * 2. Fast typing detection (>typingSpeedThreshold chars/sec AND >minimumStreamingLines over time)
 */
export class ChangeTracker {
  private trackingStates: Map<string, ChangeTrackingState> = new Map();
  private onRegionsCreatedCallback?: (uri: vscode.Uri) => void;

  constructor(private regionManager: RegionManager) {}

  /**
   * Set callback to be called when new regions are created
   */
  public setOnRegionsCreated(callback: (uri: vscode.Uri) => void): void {
    this.onRegionsCreatedCallback = callback;
  }

  /**
   * Get configuration values
   */
  private getConfig() {
    const config = vscode.workspace.getConfiguration("pasteReviewReminder");
    return {
      minimumPasteLines: config.get<number>("minimumPasteLines", 20),
      minimumStreamingLines: config.get<number>("minimumStreamingLines", 20),
      typingSpeedThreshold: config.get<number>("typingSpeedThreshold", 110),
    };
  }

  /**
   * Process a text document change event
   * Checks for both paste and fast typing
   */
  public processChange(
    event: vscode.TextDocumentChangeEvent,
    oldText?: string,
    oldRegions?: Region[]
  ): void {
    const document = event.document;
    const docKey = document.uri.toString();

    for (const change of event.contentChanges) {
      if (change.text === "") {
        continue;
      }

      if (this.isPaste(change)) {
        // [UPDATED] Pass the document object, oldText, and oldRegions snapshot to the handler
        this.handlePaste(document, change, oldText, oldRegions);
        continue;
      }

      this.trackForFastTyping(docKey, document.uri, change);
    }
  }

  /**
   * Check if a change is a paste (>minimumPasteLines in single change)
   */
  private isPaste(change: vscode.TextDocumentContentChangeEvent): boolean {
    const { minimumPasteLines } = this.getConfig();
    const lineCount = change.text.split("\n").length;
    return lineCount >= minimumPasteLines;
  }

  /**
   * Heuristic to determine if a paste event is large enough to be a full-file replacement.
   * This prevents running expensive logic on every small paste.
   */
  private isFullFilePaste(
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent
  ): boolean {
    const totalDocumentLines = document.lineCount;
    // A paste is considered "full file" if the new content makes up more than 80%
    // of the final document's lines, indicating a replacement rather than an insertion.
    const pastedLines = change.text.split("\n").length;
    const coverageRatio = pastedLines / (totalDocumentLines || 1);

    return coverageRatio > 0.8;
  }

  /**
   * Handle paste detection - create regions immediately.
   */
  private handlePaste(
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent,
    oldText?: string,
    oldRegions?: Region[]
  ): void {
    const { minimumPasteLines } = this.getConfig();
    const documentUri = document.uri;

    if (
      ENABLE_REVIEWED_PASTE_CHECK &&
      oldText !== undefined &&
      oldRegions !== undefined &&
      this.isFullFilePaste(document, change)
    ) {
      // --- Step 1: Build a Set of contextual keys for all reviewed lines ---
      const oldDocumentLines = oldText.split("\n");
      const reviewedContentKeys = new Set<string>();

      for (let i = 0; i < oldDocumentLines.length; i++) {
        const isLineInOldRegion = oldRegions.some(
          (region) => i >= region.startLine && i <= region.endLine
        );
        if (!isLineInOldRegion) {
          const contextualKey = getContextualKey(oldDocumentLines, i);
          reviewedContentKeys.add(contextualKey);
        }
      }

      // --- Step 2: Check each pasted line against the Set of reviewed keys ---
      const linesToHighlight = new Set<number>();
      const pastedContentLines = change.text.split("\n");
      const startLineOfPaste = change.range.start.line;

      for (let i = 0; i < pastedContentLines.length; i++) {
        const contextualKeyInPaste = getContextualKey(pastedContentLines, i);

        // If the key for this line and its context was NOT reviewed before, highlight it.
        if (!reviewedContentKeys.has(contextualKeyInPaste)) {
          const currentLineNumber = startLineOfPaste + i;
          linesToHighlight.add(currentLineNumber);
        }
      }

      // --- Step 3: Create regions from the un-reviewed lines ---
      if (linesToHighlight.size > 0) {
        this.createRegionsFromLines(documentUri, linesToHighlight, 1);
        if (this.onRegionsCreatedCallback) {
          this.onRegionsCreatedCallback(documentUri);
        }
      }
    } else {
      // --- Fallback to Original, Simple Logic ---
      const startLine = change.range.start.line;

      const pastedLineCount = change.text.split("\n").length;
      const endLine = startLine + pastedLineCount - 1;
      const lines = new Set<number>();
      for (let line = startLine; line <= endLine; line++) {
        lines.add(line);
      }

      this.createRegionsFromLines(documentUri, lines, minimumPasteLines);
      if (this.onRegionsCreatedCallback) {
        this.onRegionsCreatedCallback(documentUri);
      }
    }
  }

  /**
   * Track a change for fast typing detection
   */
  private trackForFastTyping(
    docKey: string,
    documentUri: vscode.Uri,
    change: vscode.TextDocumentContentChangeEvent
  ): void {
    const now = Date.now();
    let state = this.trackingStates.get(docKey);

    // Start tracking if not currently tracking
    if (!state || !state.isTracking) {
      state = {
        isTracking: true,
        startTime: now,
        totalCharacters: 0,
        affectedLines: new Set(),
        lastChangeTime: now,
      };
      this.trackingStates.set(docKey, state);
    }

    // Clear existing timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    state.totalCharacters += change.text.length;
    state.lastChangeTime = now;

    const startLine = change.range.start.line;
    const endLine =
      change.range.start.line + change.text.split("\n").length - 1;
    for (let line = startLine; line <= endLine; line++) {
      state.affectedLines.add(line);
    }

    state.timeoutId = setTimeout(() => {
      this.endTracking(docKey, documentUri);
    }, TRACKING_TIMEOUT);
  }

  /**
   * End tracking and check if fast typing thresholds were exceeded
   */
  private endTracking(docKey: string, documentUri: vscode.Uri): void {
    const state = this.trackingStates.get(docKey);
    if (!state || !state.isTracking) {
      return;
    }

    const { typingSpeedThreshold, minimumStreamingLines } = this.getConfig();
    const duration = (state.lastChangeTime - state.startTime) / 1000; // in seconds
    const speed = duration > 0 ? state.totalCharacters / duration : 0;
    const lineCount = state.affectedLines.size;

    if (speed > typingSpeedThreshold && lineCount > minimumStreamingLines) {
      this.createRegionsFromLines(
        documentUri,
        state.affectedLines,
        minimumStreamingLines
      );
      if (this.onRegionsCreatedCallback) {
        this.onRegionsCreatedCallback(documentUri);
      }
    }

    state.isTracking = false;
    state.totalCharacters = 0;
    state.affectedLines.clear();
  }

  /**
   * Create regions from a set of line numbers
   */
  private createRegionsFromLines(
    documentUri: vscode.Uri,
    lines: Set<number>,
    minRegionSize: number
  ): void {
    if (lines.size === 0) {
      return;
    }

    const sortedLines = Array.from(lines).sort((a, b) => a - b);

    // Group into contiguous regions
    let regionStart = sortedLines[0];
    let regionEnd = sortedLines[0];

    for (let i = 1; i < sortedLines.length; i++) {
      const currentLine = sortedLines[i];

      if (currentLine === regionEnd + 1) {
        regionEnd = currentLine;
      } else {
        const regionSize = regionEnd - regionStart + 1;
        if (regionSize >= minRegionSize) {
          this.regionManager.addRegion(documentUri, regionStart, regionEnd);
        }
        regionStart = currentLine;
        regionEnd = currentLine;
      }
    }

    // Add the last region if it meets minimum size
    const regionSize = regionEnd - regionStart + 1;
    if (regionSize >= minRegionSize) {
      this.regionManager.addRegion(documentUri, regionStart, regionEnd);
    }
  }

  /**
   * Stop tracking for a document
   */
  public stopTracking(documentUri: vscode.Uri): void {
    const docKey = documentUri.toString();
    const state = this.trackingStates.get(docKey);
    if (state?.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    this.trackingStates.delete(docKey);
  }

  /**
   * Clear all tracking states
   */
  public clearAll(): void {
    for (const state of this.trackingStates.values()) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
    }
    this.trackingStates.clear();
  }
}
