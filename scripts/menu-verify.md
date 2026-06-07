/\*\*

- Interactive menu and editor UX verification checklist.
-
- Automated:
- - bun run test:menu
- - bun run test:document
- - bun run test:editor
-
- Manual steps after bun run dev:
- 1.  Edit text — title and status bar show dirty marker (\*)
- 2.  File → Exit with unsaved changes — save/discard/cancel prompt appears
- 3.  File → New with unsaved changes — same prompt before clearing
- 4.  File → Recent Files — lists recently opened paths
- 5.  Edit → Find (Ctrl+F) / Replace (Ctrl+H) — native dialog opens
- 6.  Edit → Undo/Redo/Cut/Copy/Paste — clipboard and undo work
- 7.  Right-click editor — context menu with undo/cut/copy/paste/select all
- 8.  Ctrl+Z / Ctrl+Y / Ctrl+X / Ctrl+C / Ctrl+V accelerators fire
      \*/
      export {};
