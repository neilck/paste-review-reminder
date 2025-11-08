# Extension Flow Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Editor                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           User pastes/generates code                 │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                         │ onDidChangeTextDocument event
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Extension.ts                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Receives all document change events               │  │
│  │  • Forwards to ChangeDetector                        │  │
│  │  • Registers commands & CodeLens provider            │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  ChangeDetector.ts                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Accumulate changes (100ms window)                │  │
│  │  2. Calculate: lines inserted & chars/second         │  │
│  │  3. Check: lineCount >= 20 && speed >= 110 c/s      │  │
│  │  4. If true → notify RegionManager                   │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  RegionManager.ts                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Insert //#region comment above code             │  │
│  │  2. Insert //#endregion comment below code          │  │
│  │  3. Track region metadata (lines, URI)              │  │
│  │  4. Apply background highlighting                   │  │
│  │  5. Provide CodeLens for dismissal                  │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Editor                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  //#region TODO: review generated/pasted code       │  │
│  │  ╔═══════════════════════════════════════════════╗  │  │
│  │  ║  function example() {                         ║  │  │
│  │  ║    // pasted code with highlight              ║  │  │
│  │  ║  }                                             ║  │  │
│  │  ╚═══════════════════════════════════════════════╝  │  │
│  │  //#endregion                                        │  │
│  │  [❌ Dismiss Review Reminder] ← CodeLens            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Detection Logic Flow

```
User Action (paste/AI)
        │
        ▼
Document Change Event
        │
        ▼
┌───────────────────────┐
│ Start 100ms timer    │
│ Accumulate changes   │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ Timer expires - Analyze changes:     │
│                                       │
│  lines = text.split('\n').length     │
│  chars = text.length                 │
│  speed = (chars / 0.1s) chars/sec    │
└───────────┬───────────────────────────┘
            │
            ▼
   ┌────────┴────────┐
   │  lines >= 20?   │
   └────────┬────────┘
            │ YES
            ▼
   ┌────────────────┐
   │ speed >= 110?  │
   └────────┬───────┘
            │ YES
            ▼
   ┌────────────────────┐
   │ Create region!     │
   │ Add highlights!    │
   │ Show CodeLens!     │
   └────────────────────┘
```

## Dismissal Flow

```
User clicks "Dismiss Review Reminder" CodeLens
        │
        ▼
┌───────────────────────────────────────┐
│ pasteReviewReminder.dismissRegion     │
│ command triggered                     │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ RegionManager.dismissRegionAtPosition │
│                                       │
│  1. Find region at cursor position   │
│  2. Delete //#region line            │
│  3. Delete //#endregion line         │
│  4. Remove from tracking             │
│  5. Clear decorations                │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ Clean file - no comments, no highlight│
└───────────────────────────────────────┘
```

## Data Structures

### DocumentChangeTracking

```typescript
{
  lastChangeTime: number,        // Timestamp of last change
  pendingChanges: Change[]       // Buffered changes in 100ms window
}
```

### ReviewRegion

```typescript
{
  uri: string,                   // Document URI
  startLine: number,             // First line of pasted code
  endLine: number,               // Last line of pasted code
  regionStartLine: number,       // Line with //#region
  regionEndLine: number          // Line with //#endregion
}
```

## Configuration Flow

```
User opens Settings
        │
        ▼
┌─────────────────────────────────────┐
│ pasteReviewReminder.minimumLines   │ → Default: 20
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ pasteReviewReminder.characterThreshold │ → Default: 110
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ pasteReviewReminder.highlightColor │ → Default: rgba(255,200,100,0.15)
└─────────────────────────────────────┘
        │
        ▼
Read by ChangeDetector & RegionManager at runtime
```

## Multi-Document Support

```
Document A                  Document B
    │                          │
    ├─ Region 1               ├─ Region 3
    └─ Region 2               └─ Region 4

Stored as:
Map<URI, Region[]> = {
  "file:///A.ts": [Region1, Region2],
  "file:///B.ts": [Region3, Region4]
}
```

## Language Support

```
TypeScript/JavaScript → //#region ... //#endregion
C#                    → #region ... #endregion
Python                → #region ... #endregion
Java/C++/Go/Rust     → //#region ... //#endregion

getLanguageConfig(languageId) → returns appropriate syntax
```
