// src/extension.ts

import * as vscode from "vscode";
import { RegionManager } from "./regionManager";
import { SaveManager } from "./saveManager";
import { ChangeTracker } from "./changeTracker";
import { DecorationManager } from "./decorationManager";
import { RegionCodeLensProvider } from "./codeLensProvider";
import { SaveScheduler } from "./extension-helpers/saveScheduler";
import { registerEventHandlers } from "./extension-helpers/eventHandlers";
import { registerCommandHandlers } from "./extension-helpers/commandHandlers";
import { ShadowTextManager } from "./extension-helpers/shadowTextManager"; // [NEW] Import the new manager

let regionManager: RegionManager;
let saveManager: SaveManager;
let changeTracker: ChangeTracker;
let decorationManager: DecorationManager;
let codeLensProvider: RegionCodeLensProvider;
let saveScheduler: SaveScheduler;
let shadowTextManager: ShadowTextManager;

export function activate(context: vscode.ExtensionContext): void {
  console.log("Paste Review Reminder extension activated");

  regionManager = new RegionManager();
  saveManager = new SaveManager(context);
  shadowTextManager = new ShadowTextManager();
  changeTracker = new ChangeTracker(regionManager);
  decorationManager = new DecorationManager(regionManager);
  codeLensProvider = new RegionCodeLensProvider(regionManager);
  saveScheduler = new SaveScheduler(regionManager, saveManager);

  // Register CodeLens provider for all file types
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      codeLensProvider
    )
  );

  // Set up callback for when regions are created by ChangeTracker
  changeTracker.setOnRegionsCreated((uri) => {
    saveScheduler.scheduleSave(uri, true); // Immediate save for detected paste/stream
  });

  registerEventHandlers(
    context,
    regionManager,
    saveManager,
    changeTracker,
    decorationManager,
    saveScheduler,
    shadowTextManager
  );

  // Register command handlers
  registerCommandHandlers(context, regionManager, saveScheduler);

  // --- Handle already open documents ---
  // The ShadowTextManager's constructor already handles creating initial shadows for open documents.
  // This loop remains for restoring saved regions from the manifest.
  for (const editor of vscode.window.visibleTextEditors) {
    const document = editor.document;

    const savedRegions = saveManager.getRegions(document.uri);
    if (savedRegions && savedRegions.length > 0) {
      regionManager.restoreRegionsForDocument(document.uri, savedRegions);
    }
  }

  // Update decorations for currently visible editors
  decorationManager.updateAllDecorations();
}

export function deactivate(): void {
  saveScheduler?.clearAll();
  changeTracker?.clearAll();
  regionManager?.clearAll();
  regionManager?.dispose();
  decorationManager?.dispose();
  codeLensProvider?.dispose();
  shadowTextManager?.dispose();
}
