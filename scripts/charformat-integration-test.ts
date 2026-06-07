/**
 * RichEdit EM_SETCHARFORMAT integration test (real HWND).
 * Run: bun run scripts/charformat-integration-test.ts
 */
import Kernel32 from "@bun-win32/kernel32";
import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { hexToColorRef } from "../src/theme/colors";
import {
  EDITOR_STYLE_FLAGS,
  EDITOR_WINDOW_STYLES,
  RICHEDIT_CLASS,
} from "../src/win32/constants";
import {
  getCharFormatSelection,
  packEditorCharFormat,
  packTextColorFormat,
  setCharFormatAll,
  setCharFormatSelection,
} from "../src/win32/charformat";
import { encodeWide, ffiPtr } from "../src/win32/strings";
import { packWndClassEx } from "../src/win32/wndclass";

const NULL_PTR = null as unknown as Pointer;
const WHITE = hexToColorRef("#ffffff");
const LIME = hexToColorRef("#50fa7b");

const wndProc = new JSCallback(
  (hWnd, msg, wParam, lParam) =>
    User32.DefWindowProcW(hWnd, msg, wParam, lParam),
  {
    args: ["u64", "u32", "u64", "u64"],
    returns: "u64",
  },
);

const className = encodeWide(`BunPadCharFmtTest_${process.pid}`);
const wndClassBuf = packWndClassEx(wndProc, className, 0);
User32.RegisterClassExW(ffiPtr(wndClassBuf));

const parent = User32.CreateWindowExW(
  0,
  ffiPtr(className),
  NULL_PTR,
  WindowStyles.WS_OVERLAPPEDWINDOW,
  0,
  0,
  400,
  200,
  0n,
  0n,
  0n,
  NULL_PTR,
);
if (!parent) {
  throw new Error("CreateWindowExW parent failed");
}

const msftedit = Kernel32.LoadLibraryW(ffiPtr(encodeWide("Msftedit.dll")));
if (!msftedit) {
  throw new Error("LoadLibraryW(Msftedit.dll) failed");
}

const richClass = encodeWide(RICHEDIT_CLASS);
const editor = User32.CreateWindowExW(
  0,
  ffiPtr(richClass),
  NULL_PTR,
  EDITOR_WINDOW_STYLES | EDITOR_STYLE_FLAGS,
  0,
  0,
  380,
  160,
  parent,
  0n,
  0n,
  NULL_PTR,
);
if (!editor) {
  throw new Error("CreateWindowExW RICHEDIT50W failed");
}

const sample = encodeWide("const x = 1;");
User32.SendMessageW(editor, 0x000c, 0n, ffiPtr(sample));

const themeFormat = packEditorCharFormat(WHITE, 14, "Consolas");
if (!setCharFormatAll(editor, themeFormat.buf)) {
  throw new Error("setCharFormatAll returned false for editor theme format");
}

User32.SendMessageW(editor, 0x00b1, 0n, -1n);
const readBackAll = getCharFormatSelection(editor);
if (readBackAll !== WHITE) {
  throw new Error(
    `Expected white base color 0x${WHITE.toString(16)}, got 0x${readBackAll.toString(16)}`,
  );
}

User32.SendMessageW(editor, 0x00b1, 0n, 5n);
const tokenFormat = packTextColorFormat(LIME);
if (!setCharFormatSelection(editor, tokenFormat)) {
  throw new Error("setCharFormatSelection returned false for token color");
}

const readBackToken = getCharFormatSelection(editor);
if (readBackToken !== LIME) {
  throw new Error(
    `Expected lime token color 0x${LIME.toString(16)}, got 0x${readBackToken.toString(16)}`,
  );
}

console.log("charformat-integration-test ok");
process.exit(0);
