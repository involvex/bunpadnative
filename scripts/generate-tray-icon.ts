/**
 * Generate assets/bunpad.ico (16x16 + 32x32) for the system tray.
 * Run: bun run scripts/generate-tray-icon.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BG = { r: 37, g: 99, b: 235, a: 255 };
const FG = { r: 255, g: 255, b: 255, a: 255 };

const letterB16 = [
  "1111111000000000",
  "1111111100000000",
  "1100000110000000",
  "1100000110000000",
  "1100000110000000",
  "1111111100000000",
  "1111111000000000",
  "1100000110000000",
  "1100000110000000",
  "1100000110000000",
  "1111111100000000",
  "1111111000000000",
  "0000000000000000",
  "0000000000000000",
  "0000000000000000",
  "0000000000000000",
];

const rgbaBitmap = (size: number, pattern: string[]): Buffer => {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const row = pattern[Math.floor((y * pattern.length) / size)] ?? "";
    for (let x = 0; x < size; x += 1) {
      const bit = row[Math.floor((x * row.length) / size)] === "1";
      const color = bit ? FG : BG;
      const offset = (y * size + x) * 4;
      pixels.writeUInt8(color.b, offset);
      pixels.writeUInt8(color.g, offset + 1);
      pixels.writeUInt8(color.r, offset + 2);
      pixels.writeUInt8(color.a, offset + 3);
    }
  }
  return pixels;
};

const andMask = (size: number): Buffer => {
  const rowBytes = Math.ceil(size / 8);
  const paddedRow = Math.ceil(rowBytes / 4) * 4;
  return Buffer.alloc(paddedRow * size, 0x00);
};

const packBmpIcon = (size: number, pattern: string[]): Buffer => {
  const xor = rgbaBitmap(size, pattern);
  const and = andMask(size);
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(xor.length + and.length, 20);
  return Buffer.concat([header, xor, and]);
};

const packIco = (images: { size: number; pattern: string[] }[]): Buffer => {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries: Buffer[] = [];
  const blobs: Buffer[] = [];
  let offset = 6 + count * 16;

  for (const image of images) {
    const bmp = packBmpIcon(image.size, image.pattern);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(bmp.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    blobs.push(bmp);
    offset += bmp.length;
  }

  return Buffer.concat([header, ...entries, ...blobs]);
};

const scalePattern = (pattern: string[], size: number): string[] =>
  Array.from({ length: size }, (_, y) => {
    const srcY = Math.floor((y * pattern.length) / size);
    const srcRow = pattern[srcY] ?? "";
    return Array.from({ length: size }, (_, x) => {
      const srcX = Math.floor((x * srcRow.length) / size);
      return srcRow[srcX] ?? "0";
    }).join("");
  });

const ico = packIco([
  { size: 16, pattern: letterB16 },
  { size: 32, pattern: scalePattern(letterB16, 32) },
]);

const outDir = join(import.meta.dir, "..", "assets");
await mkdir(outDir, { recursive: true });
const outPath = join(outDir, "bunpad.ico");
await writeFile(outPath, ico);
console.log(`wrote ${outPath} (${ico.length} bytes)`);
