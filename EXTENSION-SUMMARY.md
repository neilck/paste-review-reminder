# Paste Review Reminder - VS Code Extension

## Overview

This is a complete VS Code extension that automatically detects and marks pasted or AI-generated code blocks for review. The extension monitors file changes and adds visual reminders when large blocks of text are inserted rapidly.

## Key Features

✅ **Automatic Detection**

- Monitors text changes at 110+ characters/second (configurable)
- Triggers on 20+ lines by default (configurable)
- Works with paste operations and AI code generation

✅ **Visual Reminders**

- Wraps code in `//#region TODO: review generated/pasted code` comments
- Adds `//#endregion` at the end
- Highlights lines with customizable background color

✅ **Easy Dismissal**

- CodeLens button above each region: "❌ Dismiss Review Reminder"
- Removes both region comments and highlighting
- Can be triggered via command palette

✅ **Highly Configurable**

- Minimum line count threshold
- Character speed detection threshold
- Custom highlight color

✅ **Multi-Language Support**

- TypeScript/JavaScript (and React variants)
- C#, Python, Java, C/C++, PHP, Go, Rust
- Extensible architecture for adding more languages

## Architecture

### File Structure

```
paste-review-reminder/
├── src/
│   ├── extension.ts          # Entry point, registers commands and listeners
│   ├── changeDetector.ts     # Monitors changes, detects rapid insertions
│   └── regionManager.ts      # Manages regions, highlighting, and CodeLens
├── package.json              # Extension manifest and configuration
├── tsconfig.json             # TypeScript configuration
├── .vscode/
│   ├── launch.json           # Debug configuration
│   └── tasks.json            # Build tasks
├── README.md                 # User documentation
├── SETUP.md                  # Development setup guide
└── CHANGELOG.md              # Version history
```

### Core Components

#### 1. ChangeDetector (`changeDetector.ts`)

- Listens to `onDidChangeTextDocument` events
- Accumulates changes in a 100ms window
- Calculates characters/second for each change
- Triggers region creation when thresholds are met

**Key Logic:**

```typescript
// Detection criteria
if (lineCount >= minimumLines && charsPerSecond >= charThreshold) {
  regionManager.addReviewRegion(document, startLine, lineCount);
}
```

#### 2. RegionManager (`regionManager.ts`)

- Creates `//#region` and `//#endregion` comments
- Manages text decorations (background highlighting)
- Provides CodeLens for dismissal
- Tracks active regions per document

**Key Features:**

- Language-aware region syntax
- Automatic decoration updates
- Per-document region tracking
- Clean removal of regions

#### 3. Extension (`extension.ts`)

- Activates on startup
- Registers commands and providers
- Coordinates between detector and manager
- Manages extension lifecycle

## Configuration Options

Users can customize via VS Code settings:

```json
{
  "pasteReviewReminder.minimumLines": 20,
  "pasteReviewReminder.characterThreshold": 110,
  "pasteReviewReminder.highlightColor": "rgba(255, 200, 100, 0.15)"
}
```

## How It Works

### Detection Flow

1. User pastes code or AI generates code
2. `onDidChangeTextDocument` event fires
3. ChangeDetector accumulates changes for 100ms
4. After delay, analyzes each change:
   - Counts lines in inserted text
   - Calculates characters/second
   - Checks against thresholds
5. If thresholds met, calls RegionManager

### Region Creation Flow

1. RegionManager receives request
2. Inserts `//#region` comment above code
3. Inserts `//#endregion` comment below code
4. Stores region metadata (line numbers, URI)
5. Updates text decorations for highlighting
6. Provides CodeLens for dismissal

### Dismissal Flow

1. User clicks CodeLens or uses command
2. RegionManager finds region at cursor position
3. Removes `//#region` and `//#endregion` comments
4. Clears region from tracking
5. Updates decorations to remove highlighting

## Installation & Usage

### For End Users

1. Install from `.vsix` file or marketplace (when published)
2. Extension activates automatically
3. Paste large code blocks and they'll be marked
4. Click "Dismiss Review Reminder" when done reviewing

### For Developers

See `SETUP.md` for detailed development instructions.

Quick start:

```bash
npm install
npm run compile
# Press F5 in VS Code to debug
```

## Testing

Test scenarios to verify functionality:

1. **Basic paste detection:**

   - Copy 25+ lines of code
   - Paste into a TypeScript file
   - Verify region comments and highlighting appear

2. **Threshold configuration:**

   - Set minimumLines to 5
   - Paste 10 lines
   - Verify detection still works

3. **Dismissal:**

   - Create a marked region
   - Click the CodeLens dismiss button
   - Verify comments and highlighting removed

4. **Multiple regions:**

   - Paste code in multiple locations
   - Verify each gets its own region
   - Dismiss one, verify others remain

5. **Different languages:**
   - Test with JavaScript, Python, C#
   - Verify correct region syntax used

## Extensibility

### Adding New Languages

To add support for a new language, update `getLanguageConfig()` in `regionManager.ts`:

```typescript
const languageConfigs: Record<
  string,
  { regionStart: string; regionEnd: string }
> = {
  // ... existing languages
  "ruby": { regionStart: "#region", regionEnd: "#endregion" },
  "swift": { regionStart: "//#region", regionEnd: "//#endregion" },
};
```

### Customizing Detection

Adjust the detection window in `changeDetector.ts`:

```typescript
private readonly DETECTION_WINDOW_MS = 100; // Milliseconds
```

### Adding New Commands

Register additional commands in `extension.ts`:

```typescript
const newCommand = vscode.commands.registerCommand(
  "pasteReviewReminder.newCommand",
  () => {
    // Command logic
  }
);
context.subscriptions.push(newCommand);
```

## Future Enhancements

Potential features to add:

- [ ] Statistics tracking (how many regions created/dismissed)
- [ ] Auto-dismiss after X days
- [ ] Different highlight colors per region
- [ ] Integration with TODO tree extensions
- [ ] Export report of all review regions
- [ ] Keyboard shortcuts for dismissal
- [ ] Per-language configuration
- [ ] Git integration (mark regions with commit hash)

## Technical Notes

- Uses VS Code's Workspace Edit API for comment insertion
- Text decorations are non-invasive (don't modify file)
- CodeLens provider runs on-demand for performance
- Region tracking survives file edits (line numbers update)
- Supports multiple documents simultaneously
- Memory efficient (cleans up on document close)

## Troubleshooting

**Region not detected:**

- Check if text inserted meets minimum line threshold
- Verify character speed is above threshold
- Ensure language is supported

**Highlighting not visible:**

- Check highlight color in settings
- Try a more opaque color: `rgba(255, 200, 100, 0.3)`

**CodeLens not appearing:**

- Verify CodeLens is enabled in VS Code settings
- Check if region comments are valid
- Reopen the file

## License

MIT - Free to use and modify
