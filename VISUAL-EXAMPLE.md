# Visual Example - Extension in Action

## Before Pasting

```typescript
// Your existing code
import { Component } from 'react';

class MyComponent extends Component {
  // ... your code
}

█ <-- Cursor here
```

## User Action: Paste Large Code Block

You copy this code from somewhere:

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

class ProductService {
  private products: Map<string, Product> = new Map();

  addProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  updateStock(id: string, inStock: boolean): boolean {
    const product = this.products.get(id);
    if (product) {
      product.inStock = inStock;
      return true;
    }
    return false;
  }
}
```

**And paste it** → The extension detects:

- ✅ 27 lines (≥ 20 threshold)
- ✅ ~1,500 characters inserted in <0.1 seconds
- ✅ Speed: 15,000 chars/sec (≫ 110 threshold)

## After Pasting - Extension Activates!

```typescript
// Your existing code
import { Component } from 'react';

class MyComponent extends Component {
  // ... your code
}

//#region TODO: review generated/pasted code
╔════════════════════════════════════════════════════════════════╗
║ interface Product {                                            ║
║     id: string;                                                ║
║     name: string;                                              ║
║     price: number;                                             ║
║     category: string;                                          ║
║     inStock: boolean;                                          ║
║ }                                                              ║
║                                                                ║
║ class ProductService {                                         ║
║     private products: Map<string, Product> = new Map();        ║
║                                                                ║
║     addProduct(product: Product): void {                       ║
║         this.products.set(product.id, product);                ║
║     }                                                          ║
║                                                                ║
║     getProduct(id: string): Product | undefined {              ║
║         return this.products.get(id);                          ║
║     }                                                          ║
║                                                                ║
║     getAllProducts(): Product[] {                              ║
║         return Array.from(this.products.values());             ║
║     }                                                          ║
║                                                                ║
║     updateStock(id: string, inStock: boolean): boolean {       ║
║         const product = this.products.get(id);                 ║
║         if (product) {                                         ║
║             product.inStock = inStock;                         ║
║             return true;                                       ║
║         }                                                      ║
║         return false;                                          ║
║     }                                                          ║
║ }                                                              ║
╚════════════════════════════════════════════════════════════════╝
//#endregion

```

**What you see:**

1. 📝 `//#region TODO: review generated/pasted code` comment (line 7)
2. 🎨 Yellow/orange background on all pasted lines (lines 8-35)
3. 📝 `//#endregion` comment (line 36)
4. 🔘 CodeLens button above: **❌ Dismiss Review Reminder**

**Visual Legend:**

```
╔═══╗  ← Represents the background highlight
║   ║    (actual color: rgba(255, 200, 100, 0.15))
╚═══╝    It's subtle but visible!
```

## In Real VS Code

The actual appearance looks like this:

```
Line 7:  //#region TODO: review generated/pasted code
         ❌ Dismiss Review Reminder                      ← CodeLens (clickable)
         ┌────────────────────────────────────────────┐
Line 8:  │ interface Product {                        │ ← Highlighted
Line 9:  │     id: string;                            │ ← Highlighted
Line 10: │     name: string;                          │ ← Highlighted
         │     ... (rest of pasted code)              │ ← Highlighted
Line 35: │ }                                           │ ← Highlighted
         └────────────────────────────────────────────┘
Line 36: //#endregion
```

## Features in Action

### 1. Collapsible Regions

Because it uses `//#region`, you can collapse it in VS Code:

```typescript
//#region TODO: review generated/pasted code ...
```

Click the arrow to expand/collapse!

### 2. Searchable

You can search for all review regions:

Press `Ctrl+F` (or `Cmd+F`) and search for:

```
TODO: review
```

Finds all marked regions across all files!

### 3. Git-Friendly

The region comments are real text, so they:

- ✅ Show up in git diff
- ✅ Can be committed (reminder for reviewers)
- ✅ Survive across sessions

### 4. Non-Invasive Highlights

The background color is just decoration:

- ✅ Doesn't modify the file
- ✅ Not saved to disk
- ✅ Disappears when dismissed

## Multiple Regions Example

If you paste multiple times:

```typescript
//#region TODO: review generated/pasted code
// First pasted block
function helperOne() { ... }
//#endregion

// Your manual code
const x = 1;

//#region TODO: review generated/pasted code
// Second pasted block
function helperTwo() { ... }
//#endregion

// More of your code
```

Each block gets its own:

- Independent region
- Separate highlighting
- Own dismiss button

## After Dismissal

When you click "Dismiss Review Reminder":

```typescript
// Your existing code
import { Component } from "react";

class MyComponent extends Component {
  // ... your code
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

class ProductService {
  private products: Map<string, Product> = new Map();

  addProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  // ... rest of code
}
```

**Clean file!**

- ❌ No region comments
- ❌ No highlighting
- ✅ Just your code

## Different Languages Example

### Python

```python
#region TODO: review generated/pasted code
╔════════════════════════════════════════════════╗
║ def calculate_fibonacci(n):                   ║
║     if n <= 1:                                 ║
║         return n                               ║
║     return calculate_fibonacci(n-1) + ...      ║
╚════════════════════════════════════════════════╝
#endregion
```

### C#

```csharp
#region TODO: review generated/pasted code
╔════════════════════════════════════════════════╗
║ public class CustomerService {                 ║
║     private readonly IRepository _repo;        ║
║     // ... generated code                      ║
╚════════════════════════════════════════════════╝
#endregion
```

### JavaScript

```javascript
//#region TODO: review generated/pasted code
╔════════════════════════════════════════════════╗
║ const apiClient = {                            ║
║   async fetchData(url) {                       ║
║     // ... pasted code                         ║
╚════════════════════════════════════════════════╝
//#endregion
```

## Configuration Impact

### Default Settings (20 lines, 110 c/s)

```typescript
// This gets detected ✅
// 25 lines pasted
[Paste 25 lines of code]
→ //#region TODO: review generated/pasted code

// This doesn't ❌
// 15 lines pasted (below threshold)
[Paste 15 lines of code]
→ No region created
```

### Lowered Threshold (5 lines)

```typescript
// After setting minimumLines = 5

// Now this gets detected ✅
[Paste 8 lines of code]
→ //#region TODO: review generated/pasted code
```

### Custom Highlight Color

With `highlightColor: "rgba(100, 200, 255, 0.25)"`:

```typescript
//#region TODO: review generated/pasted code
╔════════════════════════════════════════════════╗
║ // Code with BLUE background instead of yellow ║
╚════════════════════════════════════════════════╝
//#endregion
```

## Real-World Scenarios

### Scenario 1: ChatGPT Code

You ask ChatGPT for a function:

```
Copy code from ChatGPT → Paste in VS Code
→ Immediately marked with TODO region
→ Review before using!
```

### Scenario 2: Stack Overflow

You find a solution:

```
Copy from Stack Overflow → Paste in your file
→ Marked for review
→ Adapt to your needs, then dismiss
```

### Scenario 3: GitHub Copilot

Copilot generates 30 lines:

```
Copilot types super fast → Extension detects
→ Wrapped in TODO region
→ Review AI suggestion, keep or dismiss
```

## Tips for Best Experience

1. **Make it visible**: Set highlight color brighter for testing

   ```
   "rgba(255, 200, 100, 0.3)"
   ```

2. **Lower threshold**: For testing, set to 5 lines

   ```json
   "pasteReviewReminder.minimumLines": 5
   ```

3. **Search regions**: Use `Ctrl+Shift+F` to find all TODO regions

4. **Use command**: Open command palette, type "Dismiss Review"

5. **Region benefits**: Collapse/expand with VS Code's region folding

---

This is what you'll see when using the extension! Simple, effective, non-intrusive. ✨
