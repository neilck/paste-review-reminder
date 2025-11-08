import * as vscode from "vscode";

interface ReviewRegion {
  uri: string;
  startLine: number;
  endLine: number;
  regionStartLine: number; // Line with //#region comment
  regionEndLine: number; // Line with //#endregion comment
}

export class RegionManager implements vscode.Disposable {
  private regions: Map<string, ReviewRegion[]> = new Map();
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    console.log("[RegionManager] Initializing...");

    const config = vscode.workspace.getConfiguration("pasteReviewReminder");
    const highlightColor = config.get<string>(
      "highlightColor",
      "rgba(255, 200, 100, 0.15)"
    );

    console.log("[RegionManager] Highlight color:", highlightColor);

    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: highlightColor,
      isWholeLine: true,
    });

    // Apply decorations to visible editors on startup
    vscode.window.visibleTextEditors.forEach((editor) => {
      this.updateDecorations(editor);
    });

    // Update decorations when active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        this.updateDecorations(editor);
      }
    });

    // Update decorations when visible editors change
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      editors.forEach((editor) => this.updateDecorations(editor));
    });

    console.log("[RegionManager] Initialized successfully");
  }

  async addReviewRegion(
    document: vscode.TextDocument,
    startLine: number,
    lineCount: number
  ): Promise<void> {
    console.log("[RegionManager] addReviewRegion called:", {
      document: document.uri
        .toString()
        .substring(document.uri.toString().lastIndexOf("/") + 1),
      startLine,
      lineCount,
    });

    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === document.uri.toString()
    );

    if (!editor) {
      console.log("[RegionManager] ❌ No visible editor found for document");
      return;
    }

    console.log("[RegionManager] ✅ Found editor, creating region...");

    const endLine = startLine + lineCount - 1;
    const languageConfig = this.getLanguageConfig(document.languageId);

    console.log("[RegionManager] Language config:", {
      languageId: document.languageId,
      regionStart: languageConfig.regionStart,
      regionEnd: languageConfig.regionEnd,
    });

    const edit = new vscode.WorkspaceEdit();

    // Insert //#region comment at the start
    const startPosition = new vscode.Position(startLine, 0);
    const regionComment = `${languageConfig.regionStart} TODO: review generated/pasted code\n`;
    edit.insert(document.uri, startPosition, regionComment);

    // Insert //#endregion comment at the end
    const endPosition = new vscode.Position(endLine + 1, 0);
    const endRegionComment = `${languageConfig.regionEnd}\n`;
    edit.insert(document.uri, endPosition, endRegionComment);

    await vscode.workspace.applyEdit(edit);

    console.log("[RegionManager] ✅ Workspace edit applied");

    // Track the region
    const uri = document.uri.toString();
    const regions = this.regions.get(uri) || [];

    regions.push({
      uri,
      startLine,
      endLine: endLine + 2, // Account for the two inserted lines
      regionStartLine: startLine,
      regionEndLine: endLine + 2,
    });

    this.regions.set(uri, regions);

    console.log(
      "[RegionManager] Region tracked. Total regions for this document:",
      regions.length
    );

    // Update decorations
    this.updateDecorations(editor);

    console.log("[RegionManager] Decorations updated");
  }

  async dismissRegionAtPosition(
    editor: vscode.TextEditor,
    position: vscode.Position
  ): Promise<void> {
    const uri = editor.document.uri.toString();
    const regions = this.regions.get(uri);

    if (!regions) {
      return;
    }

    const line = position.line;
    const regionIndex = regions.findIndex(
      (region) => line >= region.regionStartLine && line <= region.regionEndLine
    );

    if (regionIndex === -1) {
      vscode.window.showInformationMessage(
        "No review region found at cursor position"
      );
      return;
    }

    const region = regions[regionIndex];
    const edit = new vscode.WorkspaceEdit();

    // Remove the //#region line
    const startLine = editor.document.lineAt(region.regionStartLine);
    const startRange = new vscode.Range(
      region.regionStartLine,
      0,
      region.regionStartLine + 1,
      0
    );
    edit.delete(editor.document.uri, startRange);

    // Remove the //#endregion line (adjust for the first deletion)
    const endRange = new vscode.Range(
      region.regionEndLine - 1,
      0,
      region.regionEndLine,
      0
    );
    edit.delete(editor.document.uri, endRange);

    await vscode.workspace.applyEdit(edit);

    // Remove region from tracking
    regions.splice(regionIndex, 1);
    if (regions.length === 0) {
      this.regions.delete(uri);
    }

    // Update decorations
    this.updateDecorations(editor);
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const uri = document.uri.toString();
    const regions = this.regions.get(uri);

    if (!regions) {
      return [];
    }

    return regions.map((region) => {
      const range = new vscode.Range(
        region.regionStartLine,
        0,
        region.regionStartLine,
        0
      );
      const command: vscode.Command = {
        title: "❌ Dismiss Review Reminder",
        command: "pasteReviewReminder.dismissRegion",
        arguments: [],
      };

      return new vscode.CodeLens(range, command);
    });
  }

  private updateDecorations(editor: vscode.TextEditor): void {
    const uri = editor.document.uri.toString();
    const regions = this.regions.get(uri);

    if (!regions || regions.length === 0) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const region of regions) {
      // Highlight lines between //#region and //#endregion (exclusive)
      for (let i = region.regionStartLine + 1; i < region.regionEndLine; i++) {
        const range = new vscode.Range(i, 0, i, Number.MAX_SAFE_INTEGER);
        decorations.push({ range });
      }
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  private getLanguageConfig(languageId: string): {
    regionStart: string;
    regionEnd: string;
  } {
    // Map of language IDs to their region comment syntax
    const languageConfigs: Record<
      string,
      { regionStart: string; regionEnd: string }
    > = {
      typescript: { regionStart: "//#region", regionEnd: "//#endregion" },
      javascript: { regionStart: "//#region", regionEnd: "//#endregion" },
      typescriptreact: { regionStart: "//#region", regionEnd: "//#endregion" },
      javascriptreact: { regionStart: "//#region", regionEnd: "//#endregion" },
      csharp: { regionStart: "#region", regionEnd: "#endregion" },
      python: { regionStart: "#region", regionEnd: "#endregion" },
      java: { regionStart: "//#region", regionEnd: "//#endregion" },
      cpp: { regionStart: "//#region", regionEnd: "//#endregion" },
      c: { regionStart: "//#region", regionEnd: "//#endregion" },
      php: { regionStart: "//#region", regionEnd: "//#endregion" },
      go: { regionStart: "//#region", regionEnd: "//#endregion" },
      rust: { regionStart: "//#region", regionEnd: "//#endregion" },
    };

    return (
      languageConfigs[languageId] || {
        regionStart: "//#region",
        regionEnd: "//#endregion",
      }
    );
  }

  dispose(): void {
    this.decorationType.dispose();
    this.regions.clear();
  }
}
