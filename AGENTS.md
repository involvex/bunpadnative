## Learned User Preferences

- Skip basic explanations; deliver production-ready, modular TypeScript (user has extensive agentic coding experience).
- Zero web UI — no HTML, CSS, DOM, Electron, or Tauri; all UI via native Win32 controls.
- Do not edit Plan.md when implementing plans attached to it.
- Chose Phase 3.5 theme scope `chrome_full_ui`: custom-drawn menu bar and status bar plus editor chrome (not chrome-only or syntax highlighting for v1).
- Run `bun run verify` before declaring work complete (typecheck, lint:fix, format, tests).
- Test manual runs with `bun run start` from the repo — not a stale global `bunpad.exe` until rebuilt or reinstalled.

## Learned Workspace Facts

- BunPad Native is a hyper-lightweight native text editor (VSCode/Notepad++ alternative) targeting Windows 11 Pro; later work in `NEXT-STEPS.md`.
- Runtime is Bun; Win32 via `@bun-win32/user32`, `@bun-win32/kernel32`, and `@bun-win32/comdlg32` from npm (not `bun-user32`); local reference at `D:\repos\bun-win32`.
- Message loop uses non-blocking `PeekMessageW` + `Bun.sleep(1)` — avoid `GetMessageW` in app code (blocks Bun async I/O).
- Editor uses `RICHEDIT50W` after `LoadLibraryW(Msftedit.dll)` (falls back to `EDIT`); Ctrl shortcuts and right-click context menu route through parent `WM_NOTIFY`/`EN_MSGFILTER` (0x0700) in `editorInput.ts` — enable via `EM_SETEVENTMASK` (0x0445) with `ENM_KEYEVENTS | ENM_MOUSEEVENTS`.
- FFI structs (`WNDCLASSEXW` 80 bytes, `MSG` 48 bytes, `OPENFILENAMEW` 152 bytes) are manually packed Buffers; hold strong refs to `JSCallback` WndProc and wide-string buffers on window instances (GC crashes Win32). Modal dialogs: never `wndProc.close()` in `WM_COMMAND` — use `beginClose`→`DestroyWindow`→`WM_DESTROY`, then `queueMicrotask` for `wndProc.close()`.
- Packaged exe resolves assets from its directory (`themes/`, `plugins/`, `extensions/`, `vscode-shim/`); use `ffiPtr()` / `pointerToBigInt()` for FFI buffers in compiled builds (Buffer `.ptr` polyfill may be absent).
- User settings and custom themes persist under `%APPDATA%/BunPad/` (`settings.json`, `themes/`); recent files stored in settings. `settings.json` includes `editor` toggles: word completion, auto-brackets, bracket matching, breadcrumbs.
- Top-level **Settings** menu: **Editor** (Preferences), **Themes** (list/reload/import/open folder), **Plugins & Extensions** (install plugin file/folder, import VSIX, Open VSX marketplace, reload plugins/extensions), **Folders** (open plugins/extensions dirs). Plugin folder picker uses `ffiPtr()` + plausible-pointer check in `showFolderDialog`.
- Custom menu bar and tray context menus defer `TrackPopupMenu` commands via `WM_APP_DEFER_COMMAND` after teardown. System tray (`trayIcon.ts`, `Shell_NotifyIconW`, `WM_TRAYICON`, icon `assets/bunpad.ico`): minimize/close hides to tray; double-click or tray Show restores; tray Exit or File Exit quits.
- Modal dialogs (`settingsDialog.ts`, `inputDialog.ts`): explicit size via `SetWindowPos` (Preferences 420×306); `modalGuard.ts` skips `TranslateAcceleratorW` while open; no `pumpOnce` during dialog show; disable owner and `SetForegroundWindow` on dialog only — no `HWND_TOPMOST` or `AttachThreadInput`. Never `wndProc.close()` in `WM_COMMAND` — teardown in `WM_DESTROY` via `queueMicrotask`.
- File-path breadcrumb bar (`BreadcrumbBar`, 24px) above editor; optional symbol chain for TypeScript buffers; word completion via LISTBOX popup; auto-close brackets via `EN_MSGFILTER`/`WM_CHAR` in `editorInput.ts` with tokenizer-aware string/comment skip.
- Document dirty state compares live editor text to a saved baseline with CRLF/LF normalization (`setBaseline`/`syncDirtyFromText`); do not mark dirty on every `EN_CHANGE`. Smoke/automation tests set `BUNPAD_TEST=1` to skip unsaved-changes prompts on programmatic close.
