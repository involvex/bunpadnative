/**
 * Editor Ctrl+shortcut resolver tests.
 * Run: bun run test:editor-input
 */
import { MenuCommand } from "../src/app/menu";
import { resolveCtrlShortcut } from "../src/app/editorInput";

const cases: Array<[number, MenuCommand]> = [
  [0x41, MenuCommand.EditSelectAll],
  [0x43, MenuCommand.EditCopy],
  [0x56, MenuCommand.EditPaste],
  [0x58, MenuCommand.EditCut],
  [0x5a, MenuCommand.EditUndo],
  [0x59, MenuCommand.EditRedo],
  [0x46, MenuCommand.EditFind],
  [0x48, MenuCommand.EditReplace],
  [0x4e, MenuCommand.FileNew],
  [0x4f, MenuCommand.FileOpen],
  [0x53, MenuCommand.FileSave],
];

for (const [vk, expected] of cases) {
  const command = resolveCtrlShortcut(vk);
  if (command !== expected) {
    throw new Error(
      `VK 0x${vk.toString(16)} expected ${expected}, got ${command}`,
    );
  }
}

if (resolveCtrlShortcut(0x42) !== null) {
  throw new Error("Unknown VK should return null");
}

console.log("editor-input-test ok");
