# Quick Start Guide

## Get Started in 3 Steps

### 1. Install Dependencies

```bash
cd paste-review-reminder
npm install
```

### 2. Run the Extension

```bash
npm run compile
```

Then press **F5** in VS Code to open Extension Development Host.

### 3. Test It

In the Extension Development Host window:

1. Create a new `.ts` file
2. Copy this sample code (26 lines):

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

class UserService {
  private users: Map<string, User> = new Map();

  createUser(name: string, email: string): User {
    const user: User = {
      id: Math.random().toString(36),
      name,
      email,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }
}
```

3. **Paste it** (don't type it) into the file
4. Watch for:

   - `//#region TODO: review generated/pasted code` appears above
   - `//#endregion` appears below
   - Yellow/orange background highlighting
   - **"❌ Dismiss Review Reminder"** CodeLens button

5. Click the dismiss button to remove the reminder

## That's It! 🎉

The extension is now monitoring your files for pasted or AI-generated code.

## Customize (Optional)

Open Settings in the Extension Development Host:

1. Press `Ctrl+,` (or `Cmd+,` on Mac)
2. Search for "Paste Review"
3. Adjust:
   - **Minimum Lines**: Lower to 5 to test with smaller pastes
   - **Character Threshold**: Default 110 chars/second works well
   - **Highlight Color**: Try `rgba(100, 200, 255, 0.2)` for blue

## Common Issues

**Nothing happens when I paste:**

- Make sure you paste at least 20 lines (default threshold)
- Try lowering `minimumLines` to 5 in settings
- Check the Debug Console for errors

**Can't see the highlight:**

- Try a more visible color: `rgba(255, 100, 100, 0.3)`
- Ensure the file is in focus

**No CodeLens button:**

- CodeLens appears on the `//#region` line
- Scroll to find it above your pasted code

## Next Steps

- Read `SETUP.md` for detailed development info
- Read `EXTENSION-SUMMARY.md` for architecture details
- Check `README.md` for user documentation

## Building for Production

When ready to share:

```bash
npm install -g @vscode/vsce
vsce package
```

This creates `paste-review-reminder-0.0.1.vsix` that you can install or distribute.

Install it with:

```bash
code --install-extension paste-review-reminder-0.0.1.vsix
```
