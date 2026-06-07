import { dlopen, FFIType } from "bun:ffi";

import { encodeWide, ffiPtr } from "./strings";

const gdi = dlopen("gdi32.dll", {
  CreateSolidBrush: {
    args: [FFIType.u32],
    returns: FFIType.u64,
  },
  DeleteObject: {
    args: [FFIType.u64],
    returns: FFIType.i32,
  },
  SetBkMode: {
    args: [FFIType.u64, FFIType.i32],
    returns: FFIType.i32,
  },
  SetTextColor: {
    args: [FFIType.u64, FFIType.u32],
    returns: FFIType.u32,
  },
  TextOutW: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32, FFIType.ptr, FFIType.i32],
    returns: FFIType.i32,
  },
  GetTextExtentPoint32W: {
    args: [FFIType.u64, FFIType.ptr, FFIType.i32, FFIType.ptr],
    returns: FFIType.i32,
  },
  CreateFontW: {
    args: [
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.i32,
      FFIType.u32,
      FFIType.u32,
      FFIType.u32,
      FFIType.u32,
      FFIType.u32,
      FFIType.u32,
      FFIType.u32,
      FFIType.u32,
      FFIType.ptr,
    ],
    returns: FFIType.u64,
  },
  SelectObject: {
    args: [FFIType.u64, FFIType.u64],
    returns: FFIType.u64,
  },
});

export const createSolidBrush = (colorRef: number): bigint =>
  gdi.symbols.CreateSolidBrush(colorRef);

export const deleteGdiObject = (handle: bigint): void => {
  if (handle) {
    gdi.symbols.DeleteObject(handle);
  }
};

export const setBkModeTransparent = (hdc: bigint): void => {
  gdi.symbols.SetBkMode(hdc, 1);
};

export const setTextColor = (hdc: bigint, colorRef: number): void => {
  gdi.symbols.SetTextColor(hdc, colorRef);
};

export const textOutW = (
  hdc: bigint,
  x: number,
  y: number,
  text: Buffer,
  length: number,
): void => {
  gdi.symbols.TextOutW(hdc, x, y, ffiPtr(text), length);
};

/** Measure UTF-16 text width in pixels for the currently selected font. */
export const measureTextWidth = (hdc: bigint, text: string): number => {
  const wide = encodeWide(text);
  const size = Buffer.alloc(8);
  if (
    !gdi.symbols.GetTextExtentPoint32W(
      hdc,
      ffiPtr(wide),
      text.length,
      ffiPtr(size),
    )
  ) {
    return text.length * 8;
  }

  return size.readInt32LE(0);
};

export type FontOptions = {
  height: number;
  faceName: string;
  weight?: number;
};

const DEFAULT_CHARSET = 1;
const OUT_DEFAULT_PRECIS = 0;
const CLIP_DEFAULT_PRECIS = 0;
const CLEARTYPE_QUALITY = 5;
/** FF_MODERN | FIXED_PITCH */
const FIXED_PITCH_FAMILY = 0x31;

export const createFont = (options: FontOptions): bigint => {
  const face = encodeWide(options.faceName);
  return gdi.symbols.CreateFontW(
    options.height,
    0,
    0,
    0,
    options.weight ?? 400,
    0,
    0,
    0,
    DEFAULT_CHARSET,
    OUT_DEFAULT_PRECIS,
    CLIP_DEFAULT_PRECIS,
    CLEARTYPE_QUALITY,
    FIXED_PITCH_FAMILY,
    ffiPtr(face),
  );
};

export const selectObject = (hdc: bigint, obj: bigint): bigint =>
  gdi.symbols.SelectObject(hdc, obj);

export { gdi };
