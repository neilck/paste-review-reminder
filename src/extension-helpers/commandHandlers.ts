import * as vscode from "vscode";
import type { SaveScheduler } from "./saveScheduler";
import type { RegionManager } from "../regionManager";

/**
 * Registers command handlers
 */
export function registerCommandHandlers(
  context: vscode.ExtensionContext,
  regionManager: RegionManager,
  saveScheduler: SaveScheduler
): void {
  // Register dismiss region command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pasteReviewReminder.dismissRegion",
      (documentUri: vscode.Uri, regionId: string) => {
        dismissRegion(documentUri, regionId, regionManager, saveScheduler);
      }
    )
  );

  // Register dismiss all command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pasteReviewReminder.dismissAll",
      (documentUri: vscode.Uri) => {
        dismissAllRegions(documentUri, regionManager, saveScheduler);
      }
    )
  );
}

/**
 * Dismiss a specific region
 */
function dismissRegion(
  documentUri: vscode.Uri,
  regionId: string,
  regionManager: RegionManager,
  saveScheduler: SaveScheduler
): void {
  const regions = regionManager.getRegions(documentUri);
  const filteredRegions = regions.filter((r) => r.id !== regionId);

  // Update regions (this will fire event and update decorations automatically)
  regionManager.setRegionsForDocument(documentUri, filteredRegions);

  // Save to manifest immediately
  saveScheduler.scheduleSave(documentUri, true);
}

/**
 * Dismiss all regions for a document
 */
function dismissAllRegions(
  documentUri: vscode.Uri,
  regionManager: RegionManager,
  saveScheduler: SaveScheduler
): void {
  // Clear all regions (this will fire event and update decorations automatically)
  regionManager.clearDocument(documentUri);

  // Save empty regions to manifest immediately
  saveScheduler.scheduleSave(documentUri, true);
}
