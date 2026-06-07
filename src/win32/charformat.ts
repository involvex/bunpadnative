import User32 from "@bun-win32/user32";

import { pointerToBigInt } from "./pointers";

/** RichEdit CHARFORMAT2W layout (Msftedit / RICHEDIT50W). */
export const CHARFORMAT2_SIZE = 124;

export const CFM_COLOR = 0x40000000;
export const CFM_SIZE = 0x80000000;
export const CFM_FACE = 0x20000000;
export const CFM_CHARSET = 0x08000000;
export const CFM_WEIGHT = 0x00100000;

/** Effect bit — must be cleared (via dwMask) for crTextColor to apply. */
export const CFE_AUTOCOLOR = 0x04000000;

export const EM_SETCHARFORMAT = 0x0444;
export const SCF_ALL = 4;
export const SCF_SELECTION = 1;

const FACE_NAME_OFFSET = 26;
const WEIGHT_OFFSET = 90;
const DEFAULT_CHARSET = 1;
/** FF_MODERN | FIXED_PITCH */
const FIXED_PITCH_FAMILY = 0x31;
const FW_NORMAL = 400;

const u32 = (value: number): number => value >>> 0;

export type CharFormatPack = {
  buf: Buffer;
  retain: Buffer[];
};

/** Pack a full editor theme format (color, size, weight, face). */
export const packEditorCharFormat = (
  colorRef: number,
  fontSizePt: number,
  fontFamily: string,
): CharFormatPack => {
  const buf = Buffer.alloc(CHARFORMAT2_SIZE, 0);
  const faceBuf = Buffer.from(`${fontFamily}\0`, "utf16le");
  faceBuf.copy(buf, FACE_NAME_OFFSET, 0, Math.min(faceBuf.length, 64));

  buf.writeUInt32LE(CHARFORMAT2_SIZE, 0);
  buf.writeUInt32LE(
    u32(
      CFM_COLOR |
        CFM_SIZE |
        CFM_FACE |
        CFM_CHARSET |
        CFM_WEIGHT |
        CFE_AUTOCOLOR,
    ),
    4,
  );
  buf.writeUInt32LE(0, 8);
  buf.writeInt32LE(fontSizePt * 20, 12);
  buf.writeUInt32LE(u32(colorRef), 20);
  buf.writeUInt8(DEFAULT_CHARSET, 24);
  buf.writeUInt8(FIXED_PITCH_FAMILY, 25);
  buf.writeUInt16LE(FW_NORMAL, WEIGHT_OFFSET);

  return { buf, retain: [faceBuf] };
};

/** Pack a syntax token text color (clears CFE_AUTOCOLOR). */
export const packTextColorFormat = (colorRef: number): Buffer => {
  const buf = Buffer.alloc(CHARFORMAT2_SIZE, 0);
  buf.writeUInt32LE(CHARFORMAT2_SIZE, 0);
  buf.writeUInt32LE(u32(CFM_COLOR | CFE_AUTOCOLOR), 4);
  buf.writeUInt32LE(0, 8);
  buf.writeUInt32LE(u32(colorRef), 20);
  return buf;
};

/** Apply CHARFORMAT2 to the whole RichEdit buffer. */
export const applyCharFormatAll = (
  editorHwnd: bigint,
  format: Buffer,
): void => {
  User32.SendMessageW(
    editorHwnd,
    EM_SETCHARFORMAT,
    BigInt(SCF_ALL),
    pointerToBigInt(format),
  );
};

/** Apply CHARFORMAT2 to the current selection. */
export const applyCharFormatSelection = (
  editorHwnd: bigint,
  format: Buffer,
): void => {
  User32.SendMessageW(
    editorHwnd,
    EM_SETCHARFORMAT,
    BigInt(SCF_SELECTION),
    pointerToBigInt(format),
  );
};
