import { dlopen, FFIType } from "bun:ffi";

import { ffiPtr } from "./pointers";

/** DWMWA_USE_IMMERSIVE_DARK_MODE (Win10 20H1+) */
const DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
/** DWMWA_USE_IMMERSIVE_DARK_MODE before 20H1 builds */
const DWMWA_USE_IMMERSIVE_DARK_MODE_LEGACY = 19;

/** PreferredAppMode.AllowDark — best-effort; optional on older builds. */
const ALLOW_DARK = 1;
const DEFAULT_MODE = 0;

type DwmApi = {
  symbols: {
    DwmSetWindowAttribute: (
      hwnd: bigint,
      attr: number,
      value: Buffer,
      size: number,
    ) => number;
  };
};

type UxTheme = {
  symbols: {
    SetPreferredAppMode: (mode: number) => number;
  };
};

const loadDwm = (): DwmApi | null => {
  try {
    return dlopen("dwmapi.dll", {
      DwmSetWindowAttribute: {
        args: [FFIType.u64, FFIType.u32, FFIType.ptr, FFIType.u32],
        returns: FFIType.i32,
      },
    }) as DwmApi;
  } catch {
    return null;
  }
};

const loadUxTheme = (): UxTheme | null => {
  try {
    return dlopen("uxtheme.dll", {
      SetPreferredAppMode: {
        args: [FFIType.i32],
        returns: FFIType.i32,
      },
    }) as UxTheme;
  } catch {
    return null;
  }
};

const dwm = loadDwm();
const uxtheme = loadUxTheme();

export const setPreferredDarkMode = (dark: boolean): void => {
  uxtheme?.symbols.SetPreferredAppMode(dark ? ALLOW_DARK : DEFAULT_MODE);
};

export const setDarkTitleBar = (hwnd: bigint, dark: boolean): void => {
  if (!dwm) {
    return;
  }

  const buf = Buffer.alloc(4);
  buf.writeInt32LE(dark ? 1 : 0, 0);
  const value = ffiPtr(buf) as unknown as Buffer;

  dwm.symbols.DwmSetWindowAttribute(
    hwnd,
    DWMWA_USE_IMMERSIVE_DARK_MODE,
    value,
    4,
  );
  dwm.symbols.DwmSetWindowAttribute(
    hwnd,
    DWMWA_USE_IMMERSIVE_DARK_MODE_LEGACY,
    value,
    4,
  );
};
