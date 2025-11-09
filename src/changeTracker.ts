import * as vscode from "vscode";
import type { ChangeTrackingState } from "./types";
import type { RegionManager } from "./regionManager";

const TRACKING_TIMEOUT = 100; // milliseconds

/**
 * Tracks text changes to detect pasted or AI-generated code
 * Two detection paths:
 * 1. Immediate paste detection (>minimumPasteLines in single change)
 * 2. Fast typing detection (>typingSpeedThreshold chars/sec AND >minimumStreamingLines over time)
 */
export class ChangeTracker {
  private trackingStates: Map<string, ChangeTrackingState> = new Map();
  private onRegionsCreated?: () => void;

  constructor(private regionManager: RegionManager) {}

  /**
   * Set callback to be called when new regions are created
   */
  public setOnRegionsCreated(callback: () => void): void {
    this.onRegionsCreated = callback;
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
  public processChange(event: vscode.TextDocumentChangeEvent): void {
    const document = event.document;
    const docKey = document.uri.toString();

    for (const change of event.contentChanges) {
      // Only track additions, not deletions
      if (change.text === "") {
        continue;
      }

      // PATH 1: Check for immediate paste (>20 lines in single change)
      if (this.isPaste(change)) {
        this.handlePaste(document.uri, change);
        // Don't add paste to typing tracking
        continue;
      }

      // PATH 2: Track for fast typing detection
      this.trackForFastTyping(docKey, document.uri, change);
    }
  }

  /**
   * Check if a change is a paste (>minimumPasteLines in single change)
   */
  private isPaste(change: vscode.TextDocumentContentChangeEvent): boolean {
    const { minimumPasteLines } = this.getConfig();
    const lineCount = change.text.split("\n").length - 1;
    return lineCount > minimumPasteLines;
  }

  /**
   * Handle paste detection - create regions immediately
   */
  private handlePaste(
    documentUri: vscode.Uri,
    change: vscode.TextDocumentContentChangeEvent
  ): void {
    const { minimumPasteLines } = this.getConfig();
    const startLine = change.range.start.line;
    const lineCount = change.text.split("\n").length - 1;
    const endLine = startLine + lineCount;

    // Create lines set for region creation
    const lines = new Set<number>();
    for (let line = startLine; line <= endLine; line++) {
      lines.add(line);
    }

    // Create regions immediately (no timeout)
    this.createRegionsFromLines(documentUri, lines, minimumPasteLines);

    // Notify that regions were created
    this.onRegionsCreated?.();
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

    // Update tracking state
    state.totalCharacters += change.text.length;
    state.lastChangeTime = now;

    // Add affected lines
    const startLine = change.range.start.line;
    const endLine =
      change.range.start.line + change.text.split("\n").length - 1;
    for (let line = startLine; line <= endLine; line++) {
      state.affectedLines.add(line);
    }

    // Set timeout to end tracking
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

    // Check if BOTH thresholds exceeded for fast typing
    if (speed > typingSpeedThreshold && lineCount > minimumStreamingLines) {
      this.createRegionsFromLines(
        documentUri,
        state.affectedLines,
        minimumStreamingLines
      );
      // Notify that regions were created
      this.onRegionsCreated?.();
    }

    // Reset tracking state
    state.isTracking = false;
    state.totalCharacters = 0;
    state.affectedLines.clear();
  }

  /**
   * Create regions from a set of line numbers
   * Combines consecutive lines into contiguous regions
   * Only creates regions that meet the minimum size threshold
   */
  private createRegionsFromLines(
    documentUri: vscode.Uri,
    lines: Set<number>,
    minRegionSize: number
  ): void {
    if (lines.size === 0) {
      return;
    }

    // Sort lines
    const sortedLines = Array.from(lines).sort((a, b) => a - b);

    // Group into contiguous regions
    let regionStart = sortedLines[0];
    let regionEnd = sortedLines[0];

    for (let i = 1; i < sortedLines.length; i++) {
      const currentLine = sortedLines[i];

      if (currentLine === regionEnd + 1) {
        // Extend current region
        regionEnd = currentLine;
      } else {
        // Save current region if it meets minimum size
        const regionSize = regionEnd - regionStart + 1;
        if (regionSize > minRegionSize) {
          this.regionManager.addRegion(documentUri, regionStart, regionEnd);
        }
        regionStart = currentLine;
        regionEnd = currentLine;
      }
    }

    // Add the last region if it meets minimum size
    const regionSize = regionEnd - regionStart + 1;
    if (regionSize > minRegionSize) {
      this.regionManager.addRegion(documentUri, regionStart, regionEnd);
    }
  }

  /**
   * Stop tracking for a document
   */
  public stopTracking(document: vscode.Uri): void {
    const docKey = document.toString();
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
