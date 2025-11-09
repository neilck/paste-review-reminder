import * as vscode from "vscode";
import type { ChangeTrackingState } from "./types";
import type { RegionManager } from "./regionManager";

const TRACKING_TIMEOUT = 100; // milliseconds

/**
 * Tracks text changes to detect pasted or AI-generated code
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
      speedThreshold: config.get<number>("characterThreshold", 110),
      sizeThreshold: config.get<number>("minimumLines", 20),
    };
  }

  /**
   * Process a text document change event
   */
  public processChange(event: vscode.TextDocumentChangeEvent): void {
    console.log("processChange called.");
    const document = event.document;
    const docKey = document.uri.toString();

    for (const change of event.contentChanges) {
      // Only track additions, not deletions
      if (change.text === "") {
        continue;
      }

      this.trackChange(docKey, document.uri, change);
    }
  }

  /**
   * Track a single content change
   */
  private trackChange(
    docKey: string,
    documentUri: vscode.Uri,
    change: vscode.TextDocumentContentChangeEvent
  ): void {
    console.log("trackChange called.");
    const now = Date.now();
    let state = this.trackingStates.get(docKey);

    // Start tracking if not currently tracking
    if (!state || !state.isTracking) {
      console.log("tracking started.");
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

    console.log("tracking updated", JSON.stringify(state, null, 2));
    console.log("affected lines", Array.from(state.affectedLines));

    // Set timeout to end tracking
    state.timeoutId = setTimeout(() => {
      this.endTracking(docKey, documentUri);
    }, TRACKING_TIMEOUT);
  }

  /**
   * End tracking and check if thresholds were exceeded
   */
  private endTracking(docKey: string, documentUri: vscode.Uri): void {
    console.log("endTracking called.");
    const state = this.trackingStates.get(docKey);
    if (!state || !state.isTracking) {
      return;
    }

    const { speedThreshold, sizeThreshold } = this.getConfig();
    const duration = (state.lastChangeTime - state.startTime) / 1000; // in seconds
    console.log(
      "speed calc",
      state.lastChangeTime,
      state.startTime,
      duration,
      state.totalCharacters
    );
    const speed = duration > 0 ? state.totalCharacters / duration : Infinity;
    const lineCount = state.affectedLines.size;

    console.log(
      "threshold check",
      speed,
      speedThreshold,
      lineCount,
      sizeThreshold
    );
    // Check if thresholds exceeded
    if (speed > speedThreshold && lineCount > sizeThreshold) {
      console.log("creating region");
      this.createRegionsFromLines(documentUri, state.affectedLines);
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
   */
  private createRegionsFromLines(
    documentUri: vscode.Uri,
    lines: Set<number>
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
        // Save current region and start new one
        this.regionManager.addRegion(documentUri, regionStart, regionEnd);
        regionStart = currentLine;
        regionEnd = currentLine;
      }
    }

    // Add the last region
    this.regionManager.addRegion(documentUri, regionStart, regionEnd);
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
