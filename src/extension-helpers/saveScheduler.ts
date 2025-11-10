import * as vscode from "vscode";
import type { SaveManager } from "../saveManager";
import type { RegionManager } from "../regionManager";

/**
 * Manages save scheduling for region changes
 * Handles both immediate saves and debounced auto-saves
 */
export class SaveScheduler {
  private saveTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private regionManager: RegionManager,
    private saveManager: SaveManager
  ) {}

  /**
   * Schedule a save for the given document
   * @param uri Document URI
   * @param immediate If true, save immediately. If false, debounce the save.
   */
  public scheduleSave(uri: vscode.Uri, immediate: boolean): void {
    const key = uri.toString();

    // Cancel existing timer
    const existingTimer = this.saveTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.saveTimers.delete(key);
    }

    if (immediate) {
      this.saveNow(uri);
    } else {
      const config = vscode.workspace.getConfiguration("pasteReviewReminder");
      const delay = config.get<number>("autoSaveDelay", 3000);
      const timer = setTimeout(() => this.saveNow(uri), delay);
      this.saveTimers.set(key, timer);
    }
  }

  /**
   * Save regions for a document immediately
   */
  private saveNow(uri: vscode.Uri): void {
    const regions = this.regionManager.getRegions(uri);
    this.saveManager.saveFileRegions(uri, regions);
    this.saveTimers.delete(uri.toString());
  }

  /**
   * Clear timer for a specific document
   */
  public clearTimer(uri: vscode.Uri): void {
    const key = uri.toString();
    const timer = this.saveTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(key);
    }
  }

  /**
   * Clear all timers
   */
  public clearAll(): void {
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
  }
}
