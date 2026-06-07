# Next Development Steps

Current status: **Phases 1–5 complete** (window, file I/O, menus, plugin API, VS Code shim, compile packaging). Below are the prioritized next steps for continued development.

---

## Phase 6: Editor Experience Hardening

### 6.1 Multi-Buffer / Tab System
- [ ] Add tab bar UI above editor area (native Win32 custom-drawn control)
- [ ] Implement buffer manager: open multiple files in tabs, switch between them
- [ ] Dirty-state tracking per tab (modified indicator in tab title)
- [ ] Ctrl+Tab / Ctrl+Shift+Tab tab switching
- [ ] Middle-click close on tabs

### 6.2 Find & Replace
- [ ] Native Find dialog (`GetOpenFileNameW`-style but custom modal)
- [ ] Incremental search (real-time highlighting as user types)
- [ ] Regex support via `RegExp` matching against buffer text
- [ ] Replace / Replace All with undo support
- [ ] Ctrl+F / Ctrl+H keyboard shortcuts

### 6.3 Undo / Redo Stack
- [ ] Implement undo/redo history as a stack of buffer snapshots
- [ ] Ctrl+Z / Ctrl+Y keyboard shortcuts
- [ ] Undo granularity: group rapid keystrokes into single undo steps

### 6.4 Line Numbers & Gutter
- [ ] Custom-drawn line number gutter to the left of the editor
- [ ] Gutter width adapts to document line count
- [ ] Current line highlight in gutter

---

## Phase 7: Window Chrome & Custom Drawing

### 7.1 Custom Title Bar
- [ ] Extend dark title bar to include custom close/minimize/maximize buttons
- [ ] Window drag handling on custom title bar region
- [ ] Double-click to maximize/restore

### 7.2 Status Bar Enhancements
- [ ] Line/column indicator (live update from editor cursor position)
- [ ] File encoding display (UTF-8 default)
- [ ] Language mode indicator (for future syntax highlighting)
- [ ] Clickable segments (e.g., click line/column to open "Go to Line" dialog)

### 7.3 Resizable Split Panes
- [ ] Vertical split: side-by-side editor views
- [ ] Draggable splitter bar between panes
- [ ] Each pane independent buffer/tab set

---

## Phase 8: Syntax Highlighting (Scope: v1 Basics)

### 8.1 Highlighting Engine
- [ ] Rule-based tokenizer (regex patterns mapped to token types)
- [ ] Theme token color mapping (extend theme JSON with `tokens` section)
- [ ] Apply highlighting to RICHEDIT50W via character formatting ranges

### 8.2 Language Support (Initial)
- [ ] JSON
- [ ] TypeScript / JavaScript
- [ ] Markdown
- [ ] Plain text (no highlighting)

### 8.3 Performance
- [ ] Lazy re-highlight on text change (only re-tokenize visible lines + dirty range)
- [ ] Debounce highlighting updates to avoid lag on large files

---

## Phase 9: Auto-Complete & IntelliSense Lite

### 9.1 Word Completion
- [ ] Scan buffer for unique words, build completion list
- [ ] Trigger on typing (configurable threshold: 3+ chars)
- [ ] Native popup list for completion candidates

### 9.2 Snippet Expansion
- [ ] Parse VS Code snippet syntax (`${1:placeholder}`, `$TM_SELECTED_TEXT`)
- [ ] Tab stops with cursor jumping
- [ ] Built-in snippets for common patterns (function, if, for, etc.)

---

## Phase 10: Settings & Configuration

### 10.1 Settings System
- [ ] `settings.json` in `%APPDATA%/BunPad/`
- [ ] Expose settings to plugins and extensions
- [ ] Settings categories: Editor, Theme, Keybindings, Extensions

### 10.2 Keybinding Customization
- [ ] `keybindings.json` configuration file
- [ ] User-defined keyboard shortcuts mapped to commands
- [ ] Conflict detection and resolution

### 10.3 File Associations
- [ ] Map file extensions to language modes
- [ ] Persist file associations in settings

---

## Phase 11: File System & Workspace

### 11.1 Explorer Panel
- [ ] Sidebar tree view of workspace folder
- [ ] Native Win32 tree control for directory browsing
- [ ] File icons (simple type-based icons)

### 11.2 Recent Files
- [ ] Track recently opened files in `%APPDATA%/BunPad/recent.json`
- [ ] Ctrl+R quick picker for recent files
- [ ] Jump list integration (Windows taskbar recent docs)

### 11.3 File Watching
- [ ] Watch open files for external changes
- [ ] Prompt to reload when file modified outside editor
- [ ] Watch workspace folder for new/deleted files

---

## Phase 12: Advanced Features

### 12.1 Minimap
- [ ] Render miniature overview of buffer to the right of editor
- [ ] Click/drag on minimap to scroll
- [ ] Visible-range indicator

### 12.2 Integrated Terminal (Stretch)
- [ ] Spawn child process (Bun `spawn`)
- [ ] Pipe I/O to/from a terminal buffer in the editor
- [ ] Terminal panel at bottom of window

### 12.3 Git Integration (Stretch)
- [ ] Read `.git` directory for status
- [ ] Show modified/new/deleted file indicators in explorer
- [ ] Inline diff view for changed lines

---

## Phase 13: Testing & Quality

### 13.1 Test Coverage
- [ ] Unit tests for theme parsing and validation
- [ ] Unit tests for plugin loading and lifecycle
- [ ] Integration tests for file open/save round-trip
- [ ] Integration tests for VS Code extension shim

### 13.2 CI/CD
- [ ] GitHub Actions workflow: lint → typecheck → test → build
- [ ] Release automation: tag → build exe → GitHub Release
- [ ] Auto-update check on startup (compare version against GitHub releases)

### 13.3 Documentation
- [ ] Plugin authoring guide (detailed API reference)
- [ ] Extension compatibility matrix (what works, what doesn't)
- [ ] Theme authoring guide with examples
- [ ] Contributing guide

---

## Phase 14: Performance & Polish

### 14.1 Large File Handling
- [ ] Lazy loading for files > 1MB
- [ ] Memory-mapped file I/O for very large files
- [ ] Virtual scrolling (only render visible lines)

### 14.2 Startup Optimization
- [ ] Defer theme loading until after window creation
- [ ] Lazy plugin loading (load on first use)
- [ ] Measure and optimize cold start time

### 14.3 Accessibility
- [ ] Screen reader compatibility (UI Automation / MSAA)
- [ ] High DPI support (per-monitor DPI awareness)
- [ ] Keyboard-only navigation for all UI elements

---

## Priority Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | 6.1 Multi-Buffer / Tabs | Medium | High — core editor UX |
| 2 | 6.2 Find & Replace | Medium | High — essential feature |
| 3 | 7.1 Custom Title Bar | Low | Medium — polish |
| 4 | 7.2 Status Bar Enhancements | Low | Medium — polish |
| 5 | 6.3 Undo / Redo | Medium | High — but RichEdit may handle this natively |
| 6 | 6.4 Line Numbers | Medium | Medium — improves code editing |
| 7 | 13.1 Test Coverage | Medium | High — quality foundation |
| 8 | 8.1 Highlighting Engine | High | High — differentiator |
| 9 | 10.1 Settings System | Medium | High — extensibility |
| 10 | 11.1 Explorer Panel | High | Medium — nice to have |
