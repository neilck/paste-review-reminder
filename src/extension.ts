import * as vscode from "vscode";
import { RegionManager } from "./regionManager";
import { SaveManager } from "./saveManager";
import { ChangeTracker } from "./changeTracker";
import { DecorationManager } from "./decorationManager";
import { RegionCodeLensProvider } from "./codeLensProvider";
import { SaveScheduler } from "./extension-helpers/saveScheduler";
import { registerEventHandlers } from "./extension-helpers/eventHandlers";
import { registerCommandHandlers } from "./extension-helpers/commandHandlers";

let regionManager: RegionManager;
let saveManager: SaveManager;
let changeTracker: ChangeTracker;
let decorationManager: DecorationManager;
let codeLensProvider: RegionCodeLensProvider;
let saveScheduler: SaveScheduler;

export function activate(context: vscode.ExtensionContext): void {
  console.log("Paste Review Reminder extension activated");

  // Initialize managers
  regionManager = new RegionManager();
  saveManager = new SaveManager(context);
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

  // Register event listeners
  registerEventHandlers(
    context,
    regionManager,
    saveManager,
    changeTracker,
    decorationManager,
    saveScheduler
  );

  // Register command handlers
  registerCommandHandlers(context, regionManager, saveScheduler);

  // --- Handle already open documents ---
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
}
