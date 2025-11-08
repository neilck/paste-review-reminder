# Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Visual Studio Code

## Installation for Development

1. Clone or download this repository
2. Navigate to the project directory:

   ```bash
   cd paste-review-reminder
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Compile the extension:
   ```bash
   npm run compile
   ```

## Running the Extension

### Method 1: Debug in VS Code (Recommended)

1. Open the project folder in VS Code
2. Press `F5` or go to Run > Start Debugging
3. This will open a new Extension Development Host window
4. Open any TypeScript file and test by pasting large blocks of code

### Method 2: Watch Mode

1. Run the watch task:
   ```bash
   npm run watch
   ```
2. Press `F5` in VS Code
3. The extension will automatically recompile when you make changes

## Testing the Extension

1. In the Extension Development Host window, create a new TypeScript file
2. Copy a large block of code (20+ lines)
3. Paste it into the file
4. You should see:

   - `//#region TODO: review generated/pasted code` comment above
   - `//#endregion` comment below
   - Background highlighting on the pasted lines
   - A "❌ Dismiss Review Reminder" CodeLens above the region

5. Click the dismiss button to remove the reminder

## Configuration

Test different configurations by opening Settings in the Extension Development Host:

- Search for "Paste Review Reminder"
- Adjust the minimum lines threshold
- Adjust the character speed threshold
- Change the highlight color

## Building for Distribution

To create a .vsix file for distribution:

1. Install vsce globally:

   ```bash
   npm install -g @vscode/vsce
   ```

2. Package the extension:

   ```bash
   vsce package
   ```

3. This creates a `.vsix` file you can install or share

## Installing the .vsix File

To install the packaged extension:

```bash
code --install-extension paste-review-reminder-0.0.1.vsix
```

Or in VS Code:

1. Go to Extensions view (Ctrl+Shift+X)
2. Click the "..." menu
3. Select "Install from VSIX..."
4. Choose the .vsix file

## Troubleshooting

### Extension not activating

- Check the Debug Console for error messages
- Ensure all dependencies are installed (`npm install`)
- Try recompiling (`npm run compile`)

### Changes not detected

- Verify the minimum lines and character threshold settings
- Check that the text is being inserted quickly enough (paste, not typing)
- Look at the Debug Console for any error messages

### CodeLens not appearing

- The CodeLens appears on the line with `//#region`
- Make sure CodeLens is enabled in VS Code settings
- Try closing and reopening the file

## Development Tips

- The main logic is in three files:

  - `extension.ts` - Entry point and command registration
  - `changeDetector.ts` - Monitors text changes and detects rapid insertions
  - `regionManager.ts` - Handles region comments, highlighting, and CodeLens

- Use `console.log()` statements - they appear in the Debug Console
- The extension activates on `onStartupFinished` for all file types
- Region detection runs on a 100ms delay to batch rapid changes
