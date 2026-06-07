## Learned User Preferences

- Skip basic explanations; deliver production-ready, modular TypeScript (user has extensive agentic coding experience).
- Zero web UI — no HTML, CSS, DOM, Electron, or Tauri; all UI via native Win32 controls.
- Do not edit Plan.md when implementing plans attached to it.
- Chose Phase 3.5 theme scope `chrome_full_ui`: custom-drawn menu bar and status bar plus editor chrome (not chrome-only or syntax highlighting for v1).

## Learned Workspace Facts

- BunPad Native is a hyper-lightweight native text editor (VSCode/Notepad++ alternative) targeting Windows 11 Pro.
- Runtime is Bun; Win32 via `@bun-win32/user32`, `@bun-win32/kernel32`, and `@bun-win32/comdlg32` from npm (not `bun-user32`).
- Local reference clone at `D:\repos\bun-win32`; canonical patterns in `packages/user32/example/mouse-trail.ts` and `packages/all/example/_gpu.ts`.
- Message loop uses non-blocking `PeekMessageW` + `Bun.sleep(1)` — avoid `GetMessageW` in app code (blocks Bun async I/O).
- Editor uses `RICHEDIT50W` after `LoadLibraryW(Msftedit.dll)`; falls back to `EDIT` if load fails.
- FFI structs (`WNDCLASSEXW` 80 bytes, `MSG` 48 bytes, `OPENFILENAMEW` 152 bytes) are manually packed Buffers; package types them as Pointer only.
- Hold strong refs to `JSCallback` WndProc and wide-string buffers on window instances (GC crashes Win32).
- Phases 1–4 implemented (window, file I/O/menus/dialogs, plugin API, VSCode shim); Phase 5 compile packaging via `bun run build` → `dist/bunpad.exe`.
- Packaged exe resolves assets from its directory (`themes/`, `plugins/`, `extensions/`, `vscode-shim/`); use `ffiPtr()` / `pointerToBigInt()` for FFI buffers in compiled builds (Buffer `.ptr` polyfill may be absent).
- Dependencies installed from npm; `file:../bun-win32` links fail due to `workspace:*` in those packages.
- Remote repo: https://github.com/involvex/bunpadnative.git
