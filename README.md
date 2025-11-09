# Paste Review Reminder

Never forget to review code pasted from other sources (like genAI), or AI streamed directly in file.

**VS Code Extension** – Reminds you to review pasted or AI-generated code blocks across your workspace, allowing tracking and highlighting of these blocks per file.

---

## Features

- **Code Block Tracking:** Automatically tracks pasted or AI-generated code blocks in your workspace.
- **Decorations:** Highlights tracked blocks in the editor for quick identification.
- **Line Change Awareness:** Lines are un-highlighted when touched (clicked, selected).
- **Per-File Storage:** Saves blocks per file to file (`.pastereview.json`), allowing Git versioning.
- **Checksum Validation:** Ensures saved blocks correspond to the current file content.
- **Git-Friendly:** The saved manifest can be committed to source control.

---

## Usage

1. Paste or generate code in your files.
2. The extension automatically tracks the new blocks.
3. Tracked blocks are highlighted in the editor.
4. Touched lines are unhighlighted.

---

## Storage

- Manifest file: `.pastereview.json` (workspace root)
- Stores per-file blocks with checksums to detect content changes.

---

## Configuration

You can customize the extension via **Settings** (`Cmd+,` on Mac, `Ctrl+,` on Windows/Linux) under **Paste Review Reminder**. Available configuration options:

- **Minimum Paste Lines (`pasteReviewReminder.minimumPasteLines`)**  
  Minimum number of lines in a paste to trigger block highlighting. Default: `20`.

- **Minimum Streaming Lines (`pasteReviewReminder.minimumStreamingLines`)**  
  Minimum number of lines typed quickly (or streamed from AI completions) to trigger block highlighting. Default: `20`.

- **Typing Speed Threshold (`pasteReviewReminder.typingSpeedThreshold`)**  
  Characters per second threshold to detect fast typing for AI completions. Default: `110`.

- **Highlight Color (`pasteReviewReminder.highlightColor`)**  
  Background color used to highlight blocks. Default: `rgba(255, 200, 100, 0.15)`.
