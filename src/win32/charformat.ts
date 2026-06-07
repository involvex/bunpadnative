import User32 from "@bun-win32/user32";

import { pointerToBigInt } from "./pointers";

/** RichEdit CHARFORMATW size (Msftedit / RICHEDIT50W). */
export const CHARFORMAT_SIZE = 92;

export const CFM_COLOR = 0x40000000;
export const CFM_SIZE = 0x80000000;
export const CFM_FACE = 0x20000000;
export const CFM_CHARSET = 0x08000000;
/** dwEffects member is valid (required to clear CFE_AUTOCOLOR). */
export const CFM_EFFECTS = 0x04000000;

/** Effect bit — must be cleared in dwEffects for crTextColor to apply. */
export const CFE_AUTOCOLOR = 0x04000000;

export const EM_SETCHARFORMAT = 0x0444;
export const EM_GETCHARFORMAT = 0x043a;
export const SCF_ALL = 4;
export const SCF_SELECTION = 1;

const EM_GETSEL = 0x00b0;
const EM_SETSEL = 0x00b1;

const FACE_NAME_OFFSET = 26;
const CR_TEXT_COLOR_OFFSET = 20;
const DEFAULT_CHARSET = 1;
/** FF_MODERN | FIXED_PITCH */
const FIXED_PITCH_FAMILY = 0x31;

const u32 = (value: number): number => value >>> 0;

/** @deprecated Use CHARFORMAT_SIZE — RichEdit rejects cbSize 124 on Windows. */
export const CHARFORMAT2_SIZE = CHARFORMAT_SIZE;

export type CharFormatPack = {
  buf: Buffer;
  retain: Buffer[];
};

const editorFormatMask = (): number =>
  u32(CFM_COLOR | CFM_SIZE | CFM_FACE | CFM_CHARSET | CFM_EFFECTS);

const textColorFormatMask = (): number => u32(CFM_COLOR | CFM_EFFECTS);

/** Read crTextColor from a CHARFORMAT buffer. */
export const readCharFormatTextColor = (buf: Buffer): number =>
  buf.readUInt32LE(CR_TEXT_COLOR_OFFSET);

/** Throw when RichEdit rejects EM_SETCHARFORMAT. */
export const assertSetCharFormatOk = (
  result: bigint,
  context: string,
): void => {
  if (result === 0n) {
    throw new Error(`EM_SETCHARFORMAT failed: ${context}`);
  }
};

const formatParam = (format: Buffer): bigint => pointerToBigInt(format);

const sendSetCharFormat = (
  editorHwnd: bigint,
  scope: number,
  format: Buffer,
): bigint =>
  User32.SendMessageW(
    editorHwnd,
    EM_SETCHARFORMAT,
    BigInt(scope),
    formatParam(format),
  );

/** Pack a full editor theme format (color, size, weight, face). */
export const packEditorCharFormat = (
  colorRef: number,
  fontSizePt: number,
  fontFamily: string,
): CharFormatPack => {
  const buf = Buffer.alloc(CHARFORMAT_SIZE, 0);
  const faceBuf = Buffer.from(`${fontFamily}\0`, "utf16le");
  faceBuf.copy(buf, FACE_NAME_OFFSET, 0, Math.min(faceBuf.length, 64));

  buf.writeUInt32LE(CHARFORMAT_SIZE, 0);
  buf.writeUInt32LE(editorFormatMask(), 4);
  buf.writeUInt32LE(0, 8);
  buf.writeInt32LE(fontSizePt * 20, 12);
  buf.writeUInt32LE(u32(colorRef), CR_TEXT_COLOR_OFFSET);
  buf.writeUInt8(DEFAULT_CHARSET, 24);
  buf.writeUInt8(FIXED_PITCH_FAMILY, 25);

  return { buf, retain: [faceBuf] };
};

/** Pack a syntax token text color (clears CFE_AUTOCOLOR). */
export const packTextColorFormat = (colorRef: number): Buffer => {
  const buf = Buffer.alloc(CHARFORMAT_SIZE, 0);
  buf.writeUInt32LE(CHARFORMAT_SIZE, 0);
  buf.writeUInt32LE(textColorFormatMask(), 4);
  buf.writeUInt32LE(0, 8);
  buf.writeUInt32LE(u32(colorRef), CR_TEXT_COLOR_OFFSET);
  return buf;
};

/** Read default character format from RichEdit. */
export const getCharFormatAll = (editorHwnd: bigint): number => {
  const buf = Buffer.alloc(CHARFORMAT_SIZE, 0);
  buf.writeUInt32LE(CHARFORMAT_SIZE, 0);
  User32.SendMessageW(
    editorHwnd,
    EM_GETCHARFORMAT,
    BigInt(SCF_ALL),
    formatParam(buf),
  );
  return readCharFormatTextColor(buf);
};

/** Read character format for the current selection. */
export const getCharFormatSelection = (editorHwnd: bigint): number => {
  const buf = Buffer.alloc(CHARFORMAT_SIZE, 0);
  buf.writeUInt32LE(CHARFORMAT_SIZE, 0);
  User32.SendMessageW(
    editorHwnd,
    EM_GETCHARFORMAT,
    BigInt(SCF_SELECTION),
    formatParam(buf),
  );
  return readCharFormatTextColor(buf);
};

/** Apply CHARFORMAT to the whole RichEdit buffer; falls back to select-all. */
export const setCharFormatAll = (
  editorHwnd: bigint,
  format: Buffer,
): boolean => {
  if (sendSetCharFormat(editorHwnd, SCF_ALL, format) !== 0n) {
    return true;
  }

  const startBuf = Buffer.alloc(4);
  const endBuf = Buffer.alloc(4);
  User32.SendMessageW(
    editorHwnd,
    EM_GETSEL,
    pointerToBigInt(startBuf),
    pointerToBigInt(endBuf),
  );
  const savedStart = startBuf.readInt32LE(0);
  const savedEnd = endBuf.readInt32LE(0);

  User32.SendMessageW(editorHwnd, EM_SETSEL, 0n, -1n);
  const ok = sendSetCharFormat(editorHwnd, SCF_SELECTION, format) !== 0n;
  User32.SendMessageW(
    editorHwnd,
    EM_SETSEL,
    BigInt(savedStart),
    BigInt(savedEnd),
  );
  return ok;
};

/** Apply CHARFORMAT to the current selection. */
export const setCharFormatSelection = (
  editorHwnd: bigint,
  format: Buffer,
): boolean => sendSetCharFormat(editorHwnd, SCF_SELECTION, format) !== 0n;

/** Apply CHARFORMAT to the whole RichEdit buffer. */
export const applyCharFormatAll = (
  editorHwnd: bigint,
  format: Buffer,
): void => {
  setCharFormatAll(editorHwnd, format);
};

/** Apply CHARFORMAT to the current selection. */
export const applyCharFormatSelection = (
  editorHwnd: bigint,
  format: Buffer,
): void => {
  setCharFormatSelection(editorHwnd, format);
};
