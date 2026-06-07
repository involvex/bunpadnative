import User32 from "@bun-win32/user32";

import type { Editor } from "../app/editor";
import { pointerToBigInt } from "../win32/pointers";
import { createFont, createSolidBrush, deleteGdiObject } from "../win32/gdi32";
import { setDarkTitleBar, setPreferredDarkMode } from "../win32/dwm";
import { fontSizeToHeight, hexToColorRef } from "./colors";
import type { ThemeDefinition } from "./types";

/** EM_SETBKGNDCOLOR — RichEdit background (wParam=0, lParam=COLORREF). */
const EM_SETBKGNDCOLOR = 0x0443;

/** EM_SETCHARFORMAT / SCF_ALL — apply format to entire buffer. */
const EM_SETCHARFORMAT = 0x0444;
const SCF_ALL = 4;
const WM_SETFONT = 0x0030;

const CFM_COLOR = 0x4000000;
const CFM_SIZE = 0x8000000;
const CFM_FACE = 0x2000000;
const CHARFORMAT2_SIZE = 92;

const packCharFormat2 = (
  theme: ThemeDefinition,
): { buf: Buffer; faceBuf: Buffer } => {
  const buf = Buffer.alloc(CHARFORMAT2_SIZE, 0);
  const faceBuf = Buffer.from(`${theme.editor.fontFamily}\0`, "utf16le");
  faceBuf.copy(buf, 24, 0, Math.min(faceBuf.length, 64));

  buf.writeUInt32LE(CHARFORMAT2_SIZE, 0);
  buf.writeUInt32LE(CFM_COLOR | CFM_SIZE | CFM_FACE, 4);
  buf.writeInt32LE(theme.editor.fontSize * 20, 12);
  buf.writeUInt32LE(hexToColorRef(theme.editor.foreground), 16);

  return { buf, faceBuf };
};

export type ThemeResources = {
  editBrush: bigint;
  font: bigint;
  retain: Buffer[];
};

export const createThemeResources = (
  theme: ThemeDefinition,
): ThemeResources => {
  const font = createFont({
    height: fontSizeToHeight(theme.editor.fontSize),
    faceName: theme.editor.fontFamily,
  });

  return {
    editBrush: createSolidBrush(hexToColorRef(theme.editor.background)),
    font,
    retain: [],
  };
};

export const destroyThemeResources = (resources: ThemeResources): void => {
  deleteGdiObject(resources.editBrush);
  deleteGdiObject(resources.font);
};

/** Apply theme to editor surface and window chrome. */
export const applyTheme = (
  hwnd: bigint,
  editor: Editor,
  theme: ThemeDefinition,
  useRichEdit: boolean,
  resources: ThemeResources,
): void => {
  setPreferredDarkMode(theme.chrome.darkTitleBar);
  setDarkTitleBar(hwnd, theme.chrome.darkTitleBar);

  const editorHwnd = editor.hwnd;
  const { buf, faceBuf } = packCharFormat2(theme);
  resources.retain.push(buf, faceBuf);

  if (useRichEdit) {
    User32.SendMessageW(
      editorHwnd,
      EM_SETBKGNDCOLOR,
      0n,
      BigInt(hexToColorRef(theme.editor.background)),
    );
    User32.SendMessageW(
      editorHwnd,
      EM_SETCHARFORMAT,
      BigInt(SCF_ALL),
      pointerToBigInt(buf),
    );
  }

  User32.SendMessageW(editorHwnd, WM_SETFONT, resources.font, 1n);
};
