import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { Region } from "./types";
import * as crypto from "crypto";

export interface SavedFileRegions {
  documentPath: string; // Relative path from workspace root
  checksum: string;
  regions: Region[];
}

export interface RegionManifest {
  files: SavedFileRegions[];
}

/**
 * Handles saving/loading regions for VS Code extension.
 * Saves regions to a JSON file on disk, one manifest for all files.
 * Uses workspace-relative paths for portability.
 */
export class SaveManager {
  private manifestPath: string;
  private manifest: RegionManifest = { files: [] };
  private workspaceRoot: string;

  constructor(
    private context: vscode.ExtensionContext,
    manifestFileName = ".pastereview.json"
  ) {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";
    this.manifestPath = path.join(this.workspaceRoot, manifestFileName);
    this.loadManifest();
  }

  /**
   * Convert absolute URI to workspace-relative path
   */
  private uriToRelativePath(uri: vscode.Uri): string | null {
    const absolutePath = uri.fsPath;
    if (!absolutePath.startsWith(this.workspaceRoot)) {
      // File is outside workspace
      return null;
    }
    const relativePath = path.relative(this.workspaceRoot, absolutePath);
    // Normalize to forward slashes for cross-platform compatibility
    return relativePath.replace(/\\/g, "/");
  }

  /**
   * Convert workspace-relative path to absolute URI
   */
  private relativePathToUri(relativePath: string): vscode.Uri {
    const absolutePath = path.join(this.workspaceRoot, relativePath);
    return vscode.Uri.file(absolutePath);
  }

  /** Load manifest from disk, remove entries for missing files */
  private loadManifest(): void {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const data = fs.readFileSync(this.manifestPath, "utf8");
        this.manifest = JSON.parse(data) as RegionManifest;

        // Remove entries where file no longer exists
        const existingFiles = this.manifest.files.filter((f) => {
          const uri = this.relativePathToUri(f.documentPath);
          return fs.existsSync(uri.fsPath);
        });
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
    const relativePath = this.uriToRelativePath(documentUri);
    if (!relativePath) {
      return [];
    }

    const file = this.manifest.files.find(
      (f) => f.documentPath === relativePath
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
      const relativePath = this.uriToRelativePath(documentUri);
      if (!relativePath) {
        // File is outside workspace, don't save
        return;
      }

      const filePath = documentUri.fsPath;
      if (!fs.existsSync(filePath)) {
        // File doesn't exist, remove entry if present
        this.manifest.files = this.manifest.files.filter(
          (f) => f.documentPath !== relativePath
        );
        this.saveManifest();
        return;
      }

      const content = fs.readFileSync(filePath, "utf8");
      const checksum = SaveManager.computeChecksum(content);

      // Replace or add file entry
      const otherFiles = this.manifest.files.filter(
        (f) => f.documentPath !== relativePath
      );

      // Only add entry if there are regions to save
      if (regions.length > 0) {
        otherFiles.push({
          documentPath: relativePath,
          checksum,
          regions,
        });
      }

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
    const relativePath = this.uriToRelativePath(documentUri);
    if (!relativePath) {
      return false;
    }

    const file = this.manifest.files.find(
      (f) => f.documentPath === relativePath
    );
    if (!file) return false;
    const checksum = SaveManager.computeChecksum(content);
    return file.checksum === checksum;
  }

  /**
   * Update file path when a file is renamed
   * Called during file rename operations
   */
  public updateFilePath(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    const oldPath = this.uriToRelativePath(oldUri);
    const newPath = this.uriToRelativePath(newUri);

    if (!oldPath || !newPath) {
      return;
    }

    const fileIndex = this.manifest.files.findIndex(
      (f) => f.documentPath === oldPath
    );

    if (fileIndex !== -1) {
      this.manifest.files[fileIndex].documentPath = newPath;
      this.saveManifest();
    }
  }
}
