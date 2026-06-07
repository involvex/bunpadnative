import User32 from "@bun-win32/user32";

import type { Editor } from "../app/editor";
import { applyCharFormatAll, packEditorCharFormat } from "../win32/charformat";
import { createFont, createSolidBrush, deleteGdiObject } from "../win32/gdi32";
import { setDarkTitleBar, setPreferredDarkMode } from "../win32/dwm";
import { fontSizeToHeight, hexToColorRef } from "./colors";
import type { ThemeDefinition } from "./types";

/** EM_SETBKGNDCOLOR — RichEdit background (wParam=0, lParam=COLORREF). */
const EM_SETBKGNDCOLOR = 0x0443;
const WM_SETFONT = 0x0030;

const EDITOR_FONT_FALLBACK = "Consolas";

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
    faceName: theme.editor.fontFamily || EDITOR_FONT_FALLBACK,
    weight: 400,
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

/** Build CHARFORMAT2 buffer for the active editor theme. */
export const packThemeEditorFormat = (
  theme: ThemeDefinition,
): ReturnType<typeof packEditorCharFormat> =>
  packEditorCharFormat(
    hexToColorRef(theme.editor.foreground),
    theme.editor.fontSize,
    theme.editor.fontFamily || EDITOR_FONT_FALLBACK,
  );

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
  const { buf, retain } = packThemeEditorFormat(theme);
  resources.retain.push(buf, ...retain);

  if (useRichEdit) {
    User32.SendMessageW(
      editorHwnd,
      EM_SETBKGNDCOLOR,
      0n,
      BigInt(hexToColorRef(theme.editor.background)),
    );
    User32.SendMessageW(editorHwnd, WM_SETFONT, resources.font, 1n);
    applyCharFormatAll(editorHwnd, buf);
    return;
  }

  User32.SendMessageW(editorHwnd, WM_SETFONT, resources.font, 1n);
};
