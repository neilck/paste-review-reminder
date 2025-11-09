import type * as vscode from "vscode";

/**
 * Represents a contiguous region of lines that were auto-generated or pasted
 */
export interface Region {
  id: string;
  startLine: number;
  endLine: number; // inclusive
  document: vscode.Uri;
}

/**
 * Tracks text changes to detect pasted or AI-generated code
 */
export interface ChangeTrackingState {
  isTracking: boolean;
  startTime: number;
  totalCharacters: number;
  affectedLines: Set<number>;
  lastChangeTime: number;
  timeoutId?: NodeJS.Timeout;
}
