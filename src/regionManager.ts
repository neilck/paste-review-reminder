import * as vscode from "vscode";
import type { Region } from "./types";

/**
 * Manages regions of pasted or AI-generated code across documents
 * Uses document URI as Map key, but doesn't store URI in Region objects
 * Emits events when regions change for reactive updates
 */
export class RegionManager {
  private regions: Map<string, Region[]> = new Map(); // key: document URI string
  private nextId = 0;
  private _onDidChangeRegions = new vscode.EventEmitter<vscode.Uri>();

  /**
   * Event fired when regions change for a document
   */
  public readonly onDidChangeRegions = this._onDidChangeRegions.event;

  /**
   * Add a new region for the given document
   */
  public addRegion(
    documentUri: vscode.Uri,
    startLine: number,
    endLine: number
  ): Region {
    const region: Region = {
      id: `region-${this.nextId++}`,
      startLine,
      endLine,
    };

    const docKey = documentUri.toString();
    const docRegions = this.regions.get(docKey) || [];
    docRegions.push(region);
    this.regions.set(docKey, docRegions);

    this._onDidChangeRegions.fire(documentUri);

    return region;
  }

  /**
   * Remove lines from regions based on a Range.
   * Handles splitting regions if lines are removed from the middle.
   * Returns true if any regions were modified.
   */
  public removeLinesFromRegions(
    documentUri: vscode.Uri,
    range: vscode.Range
  ): boolean {
    const docKey = documentUri.toString();
    const docRegions = this.regions.get(docKey);
    if (!docRegions || docRegions.length === 0) {
      return false;
    }

    let modified = false;
    const newRegions: Region[] = [];

    for (const region of docRegions) {
      const result = this.removeRangeFromRegion(region, range);

      if (result.removed) {
        modified = true;
        // Add any resulting regions (could be 0, 1, or 2)
        newRegions.push(...result.newRegions);
      } else {
        // Region not affected, keep as is
        newRegions.push(region);
      }
    }

    this.regions.set(docKey, newRegions);

    if (modified) {
      this._onDidChangeRegions.fire(documentUri);
    }

    return modified;
  }

  /**
   * Remove a range from a single region.
   * Returns the resulting regions (could be split into 0, 1, or 2 regions)
   */
  private removeRangeFromRegion(
    region: Region,
    range: vscode.Range
  ): { removed: boolean; newRegions: Region[] } {
    const rangeStartLine = range.start.line;
    const rangeEndLine = range.end.line;

    // Check if range overlaps with region
    if (rangeEndLine < region.startLine || rangeStartLine > region.endLine) {
      // No overlap
      return { removed: false, newRegions: [] };
    }

    // Determine which lines to remove from the region
    const removeStart = Math.max(rangeStartLine, region.startLine);
    const removeEnd = Math.min(rangeEndLine, region.endLine);

    const newRegions: Region[] = [];

    // Check if there's a region before the removed range
    if (region.startLine < removeStart) {
      newRegions.push({
        id: `region-${this.nextId++}`,
        startLine: region.startLine,
        endLine: removeStart - 1,
      });
    }

    // Check if there's a region after the removed range
    if (region.endLine > removeEnd) {
      newRegions.push({
        id: `region-${this.nextId++}`,
        startLine: removeEnd + 1,
        endLine: region.endLine,
      });
    }

    return { removed: true, newRegions };
  }

  /**
   * Get all regions for a document
   */
  public getRegions(documentUri: vscode.Uri): Region[] {
    const docKey = documentUri.toString();
    return this.regions.get(docKey) || [];
  }

  /**
   * Clear all regions for a document
   */
  public clearDocument(documentUri: vscode.Uri): void {
    const docKey = documentUri.toString();
    const hadRegions =
      this.regions.has(docKey) && this.regions.get(docKey)!.length > 0;
    this.regions.delete(docKey);

    if (hadRegions) {
      this._onDidChangeRegions.fire(documentUri);
    }
  }

  /**
   * Clear all regions
   */
  public clearAll(): void {
    this.regions.clear();
  }

  /**
   * Update region line numbers after document edits (for line insertions/deletions)
   * This should be called when lines are added or removed from the document
   */
  public updateRegionsAfterEdit(
    documentUri: vscode.Uri,
    range: vscode.Range,
    rangeLength: number,
    text: string
  ): void {
    const docKey = documentUri.toString();
    const docRegions = this.regions.get(docKey);
    if (!docRegions || docRegions.length === 0) {
      return;
    }

    // Calculate line delta (how many lines were added or removed)
    const newLineCount = text.split("\n").length - 1;
    const oldLineCount = range.end.line - range.start.line;
    const lineDelta = newLineCount - oldLineCount;

    if (lineDelta === 0) {
      // No line count change, no need to update
      return;
    }

    const changeEndLine = range.end.line;

    for (const region of docRegions) {
      // Only update regions that come after the change
      if (region.startLine > changeEndLine) {
        region.startLine += lineDelta;
        region.endLine += lineDelta;
      } else if (region.endLine > changeEndLine) {
        // Region spans the change point
        region.endLine += lineDelta;
      }
    }
  }

  /**
   * Update document URI for all regions when a file is renamed
   * This updates the Map key for runtime state
   */
  public updateDocumentUri(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    const oldKey = oldUri.toString();
    const newKey = newUri.toString();

    const regions = this.regions.get(oldKey);
    if (!regions) {
      return;
    }

    // Move to new key and remove the old entry
    this.regions.set(newKey, regions);
    this.regions.delete(oldKey);
  }

  /**
   * Replace regions for a document.
   * Useful when restoring from saved manifest after checksum validation.
   */
  public setRegionsForDocument(
    documentUri: vscode.Uri,
    regions: Region[]
  ): void {
    this.regions.set(documentUri.toString(), [...regions]);

    if (regions.length > 0) {
      this._onDidChangeRegions.fire(documentUri);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._onDidChangeRegions.dispose();
  }
}
