Development Plan: "BunPad Native"
Phase 1: The Bare-Metal Foundation (Days 1-2)
The goal is to get a native Windows UI rendering purely through TypeScript, bypassing any web views or Electron overhead.

Initialization: Set up a standard Bun project. Install the necessary bun-win32 packages (specifically bun-user32, bun-kernel32, and potentially bun-comctl32 for advanced UI controls).

Window Creation: Use CreateWindowExW to spawn the main application window.

The Editor Control: Do not write a custom text renderer yet. Instantiate a RICHEDIT50W (Rich Edit control) as a child window inside your main application. This gives you native text selection, scrolling, and basic formatting with zero RAM overhead.

The Message Loop: Implement the core Windows message loop (GetMessageW, TranslateMessage, DispatchMessageW) in a while loop within Bun to keep the application alive and responsive.

Phase 2: Core I/O and OS Integration (Days 3-4)
Connect the native UI to Bun's ultra-fast backend.

File Operations: Wire up Bun.file().text() and Bun.write() to the RichEdit control. Reading a file should push a string into the control; saving should extract it.

Native Menus: Build the top menu bar (File, Edit, Plugins) using CreateMenu and AppendMenuW.

Event Handling: Map the WM_COMMAND messages from the menu clicks to your TypeScript functions (e.g., clicking "Open" triggers a native GetOpenFileNameW dialog, then loads the file).

Hotkeys: Register native keyboard accelerators (Ctrl+S, Ctrl+O) via user32.dll.

Phase 3: The Native Plugin API (Days 5-6)
Build the system that makes this editor extensible without requiring C++ compilation.

Architecture: Define an EditorContext interface exposing safe methods (e.g., getText(), setText(), getCursorPosition(), showToast()).

Dynamic Loading: Create a plugins/ directory. On startup, the app scans this folder and uses await import(pluginPath) to load .ts or .js files dynamically.

Hooks: Implement a lifecycle system (e.g., onEditorReady, onBeforeSave, onTextChange) that plugins can subscribe to.

Phase 4: VSCode Extension Compatibility Layer (Days 7-10)
Candor check: You cannot support 100% of VSCode extensions (especially those relying on complex WebViews or heavy Node.js-specific native modules). However, you can support Text Manipulation and Snippet extensions.

The "Shim" Concept: VSCode extensions start with import \* as vscode from 'vscode'. You need to create a mock vscode module in your project.

Polyfilling the API:

Map vscode.window.showInformationMessage to a native Win32 MessageBoxW.

Map vscode.workspace.fs to Bun's filesystem APIs.

Map vscode.TextDocument and vscode.TextEditor commands to manipulate the native RICHEDIT50W buffer.

Manifest Parsing: Write a script to read a VSCode extension's package.json, find the activationEvents, and load the specified main JavaScript file into your compatibility layer.

Phase 5: Packaging and Optimization (Day 11)
Compile the entire project into a single executable using bun build ./index.ts --compile --outfile bunpad.exe.

Ensure the resulting binary runs cleanly on standard Windows 11 Pro environments without requiring external DLLs (other than standard Windows system libraries).
