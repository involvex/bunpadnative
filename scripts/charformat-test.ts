/**
 * CHARFORMAT2 packing sanity checks.
 * Run: bun run scripts/charformat-test.ts
 */
import {
  CHARFORMAT_SIZE,
  packEditorCharFormat,
  packTextColorFormat,
} from "../src/win32/charformat";
import { hexToColorRef } from "../src/theme/colors";

if (CHARFORMAT_SIZE !== 92) {
  throw new Error("CHARFORMAT_SIZE must be 92 for RichEdit on Windows");
}

const theme = packEditorCharFormat(
  hexToColorRef("#d4d4d4"),
  14,
  "Cascadia Code",
);
if (theme.buf.readUInt32LE(0) !== CHARFORMAT_SIZE) {
  throw new Error("cbSize not written");
}

const color = packTextColorFormat(hexToColorRef("#569cd6"));
if (color.readUInt32LE(20) !== hexToColorRef("#569cd6")) {
  throw new Error("crTextColor must be at offset 20");
}

if (color.readUInt32LE(16) === hexToColorRef("#569cd6")) {
  throw new Error("crTextColor must not be at offset 16");
}

console.log("charformat-test ok");
