# BunPad Native

A hyper-lightweight native Windows text editor built entirely in TypeScript with Bun runtime and raw Win32 API calls. No Electron. No web views. Pure native UI.

## Architecture

```
src/
├── app/          # Window, editor, menu, document management
├── extensions/   # VS Code extension host + manifest parsing
├── io/           # Native file dialogs (GetOpenFileNameW / GetSaveFileNameW)
├── loop/         # Non-blocking Win32 message pump (PeekMessageW)
├── plugins/      # Plugin API (EditorContext + lifecycle hooks)
├── theme/        # JSON theme system with live switching
├── ui/           # Custom-drawn menu bar and status bar
├── vscode/       # VS Code extension compatibility shim
└── win32/        # Low-level FFI bindings (DWM, GDI32, layout, strings)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) >= 1.1 |
| UI | Raw Win32 via `@bun-win32/user32`, `kernel32`, `comdlg32` |
| Editor | `RICHEDIT50W` (Msftedit.dll) with `EDIT` fallback |
| Language | TypeScript (strict, ESM) |
| Linting | ESLint + Prettier |
| Packaging | `bun build --compile` → single `.exe` |

## Quick Start

```bash
# Install dependencies
bun install

# Run in development (with --watch)
bun run dev

# Run production build
bun run start
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Development mode with hot reload |
| `bun run start` | Production run |
| `bun run build` | Compile to `dist/bunpad.exe` |
| `bun run verify` | Typecheck + lint + format + all tests |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint check |
| `bun run format` | Prettier formatting |
| `bun run test:smoke` | Smoke tests |
| `bun run test:plugins` | Plugin system tests |
| `bun run test:extensions` | Extension host tests |
| `bun run test:menu` | Menu system tests |

## Themes

Themes are JSON files in `themes/` with the structure:

```json
{
  "id": "dark",
  "name": "Dark",
  "ui": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "accent": "#569cd6",
    "border": "#3c3c3c",
    "menuBar": { "background": "#252526", "foreground": "#cccccc", "hover": "#3c3c3c", "active": "#569cd6" },
    "statusBar": { "background": "#252526", "foreground": "#858585", "accent": "#569cd6" }
  },
  "editor": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "selectionBackground": "#264f78",
    "caret": "#aeafad",
    "fontFamily": "Cascadia Code",
    "fontSize": 14
  },
  "chrome": { "darkTitleBar": true }
}
```

Built-in themes: `dark`, `light`, `dracula`, `monokai`, `nord`, `solarized-dark`, `high-contrast`.

## Plugins

Drop `.ts` files into `plugins/`. Each plugin exports a default `BunPadPlugin`:

```typescript
import type { BunPadPlugin } from "../src/plugins/types";

const plugin: BunPadPlugin = {
  name: "my-plugin",
  onEditorReady(ctx) { /* ... */ },
  onTextChange(ctx) { /* ... */ },
  onBeforeSave(ctx) { /* ... */ },
};

export default plugin;
```

### Available Hooks

| Hook | Fires when |
|------|-----------|
| `onEditorReady` | Editor control is initialized |
| `onTextChange` | Buffer content changes |
| `onBeforeSave` | File is about to be written |
| `onAfterSave` | File has been saved |

### EditorContext API

- `ctx.getText()` — returns full buffer text
- `ctx.setText(text)` — replaces buffer content
- `ctx.getCursorPosition()` — returns `{ line, column }`
- `ctx.showToast(message)` — shows a native toast notification

## VS Code Extensions

BunPad supports a subset of VS Code extensions (text manipulation, snippets). Drop extensions into `extensions/<name>/` with a `package.json` manifest.

The compatibility shim maps:

| VS Code API | BunPad Implementation |
|-------------|----------------------|
| `vscode.window.showInformationMessage` | `MessageBoxW` |
| `vscode.workspace.fs` | Bun filesystem APIs |
| `vscode.TextDocument` | RICHEDIT50W buffer |
| `vscode.TextEditor` | Native editor commands |

## Build & Packaging

```bash
# Full verify + compile
bun run build

# Output: dist/bunpad.exe
```

The compiled binary resolves `themes/`, `plugins/`, `extensions/`, and `vscode-shim/` relative to its own directory.

## Key Design Decisions

- **Non-blocking message loop**: Uses `PeekMessageW` + `Bun.sleep(1)` instead of `GetMessageW` to avoid blocking Bun's async I/O.
- **GC-safe FFI**: Strong references held to `JSCallback` WndProc and wide-string buffers on window instances.
- **Manual struct packing**: FFI structs (`WNDCLASSEXW`, `MSG`, `OPENFILENAMEW`) are manually packed as Buffers since packages expose `Pointer` types only.
- **No web UI**: Zero HTML, CSS, DOM, Electron, or Tauri. All UI rendered through native Win32 controls.

## Requirements

- Windows 11 Pro (or Windows 10 1809+)
- [Bun](https://bun.sh) >= 1.1.0

## License

MIT © [involvex](https://github.com/involvex)
