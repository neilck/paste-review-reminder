import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { Region } from "./types";
import * as crypto from "crypto";

export interface SavedFileRegions {
  documentUri: string;
  checksum: string;
  regions: Region[];
}

export interface RegionManifest {
  files: SavedFileRegions[];
}

/**
 * Handles saving/loading regions for VS Code extension.
 * Saves regions to a JSON file on disk, one manifest for all files.
 */
export class SaveManager {
  private manifestPath: string;
  private manifest: RegionManifest = { files: [] };

  constructor(
    private context: vscode.ExtensionContext,
    manifestFileName = ".pastereview.json"
  ) {
    const workspacePath =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
    this.manifestPath = path.join(workspacePath, manifestFileName);
    this.loadManifest();
  }

  /** Load manifest from disk, remove entries for missing files */
  private loadManifest(): void {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const data = fs.readFileSync(this.manifestPath, "utf8");
        this.manifest = JSON.parse(data) as RegionManifest;

        // Remove entries where file no longer exists
        const existingFiles = this.manifest.files.filter((f) =>
          fs.existsSync(vscode.Uri.parse(f.documentUri).fsPath)
        );
        if (existingFiles.length !== this.manifest.files.length) {
          this.manifest.files = existingFiles;
          this.saveManifest(); // immediately remove missing files
        }
      }
    } catch (err) {
      console.error("Failed to load region manifest:", err);
      this.manifest = { files: [] };
    }
  }

  /** Get saved regions for a file */
  public getRegions(documentUri: vscode.Uri): Region[] {
    const file = this.manifest.files.find(
      (f) => f.documentUri === documentUri.toString()
    );
    return file ? file.regions : [];
  }

  /** Compute checksum of text content */
  public static computeChecksum(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /** Save regions for a single file (replace existing entry) */
  public saveFileRegions(documentUri: vscode.Uri, regions: Region[]): void {
    try {
      const filePath = documentUri.fsPath;
      if (!fs.existsSync(filePath)) {
        // File doesn't exist, remove entry if present
        this.manifest.files = this.manifest.files.filter(
          (f) => f.documentUri !== documentUri.toString()
        );
        this.saveManifest();
        return;
      }

      const content = fs.readFileSync(filePath, "utf8");
      const checksum = SaveManager.computeChecksum(content);

      // Replace or add file entry
      const otherFiles = this.manifest.files.filter(
        (f) => f.documentUri !== documentUri.toString()
      );
      otherFiles.push({
        documentUri: documentUri.toString(),
        checksum,
        regions,
      });
      this.manifest.files = otherFiles;

      this.saveManifest();
    } catch (err) {
      console.error(`Failed to save regions for ${documentUri.fsPath}:`, err);
    }
  }

  /** Save manifest to disk */
  private saveManifest(): void {
    try {
      fs.mkdirSync(path.dirname(this.manifestPath), { recursive: true });
      fs.writeFileSync(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2),
        "utf8"
      );
    } catch (err) {
      console.error("Failed to save region manifest:", err);
    }
  }

  /** Check if a file's checksum matches the saved one */
  public hasMatchingChecksum(
    documentUri: vscode.Uri,
    content: string
  ): boolean {
    const file = this.manifest.files.find(
      (f) => f.documentUri === documentUri.toString()
    );
    if (!file) return false;
    const checksum = SaveManager.computeChecksum(content);
    return file.checksum === checksum;
  }
}
