/**
 * Plugin install dialog FFI regression tests.
 * Run: bun run test:plugin-dialog
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { importPluginFolder } from "../src/app/install";
import { packOpenFileName } from "../src/io/dialog";
import { isPlausibleFfiPointer, pointerToBigInt } from "../src/win32/pointers";
import { encodeWide } from "../src/win32/strings";

if (isPlausibleFfiPointer(117)) {
  throw new Error("Small integers must not be plausible FFI pointers");
}

if (!isPlausibleFfiPointer(0x10000n)) {
  throw new Error("Expected heap pointer to be plausible");
}

const fileBuf = Buffer.alloc(2048);
const fileTitleBuf = Buffer.alloc(520);
const title = encodeWide("Install Plugin");
const filter = Buffer.from("Plugins\0*.ts\0\0", "utf16le");
const ofn = packOpenFileName(
  0n,
  fileBuf,
  fileTitleBuf,
  title,
  null,
  0,
  filter,
  undefined,
  "ts",
);

const defExtPtr = new DataView(ofn.buffer).getBigUint64(0x68, true);
if (defExtPtr === 0n) {
  throw new Error("packOpenFileName should set default extension for plugins");
}

const ofnNoExt = packOpenFileName(
  0n,
  fileBuf,
  fileTitleBuf,
  title,
  null,
  0,
  filter,
);
const defExtMissing = new DataView(ofnNoExt.buffer).getBigUint64(0x68, true);
if (defExtMissing !== 0n) {
  throw new Error("packOpenFileName should omit defExt when not provided");
}

if (!isPlausibleFfiPointer(pointerToBigInt(fileBuf))) {
  throw new Error(
    "Buffer pointer should be plausible for OPENFILENAMEW packing",
  );
}

const originalCwd = process.cwd();
const tmpRoot = join(originalCwd, ".tmp-plugin-install");
const pluginPath = join(tmpRoot, "sample-plugin.ts");
await mkdir(tmpRoot, { recursive: true });
await writeFile(pluginPath, "export default { activate() {} };\n", "utf8");

process.chdir(tmpRoot);
try {
  const dest = await importPluginFolder(pluginPath);
  if (!dest.endsWith("sample-plugin.ts")) {
    throw new Error(`Unexpected plugin install destination: ${dest}`);
  }
} finally {
  process.chdir(originalCwd);
  await rm(tmpRoot, { recursive: true, force: true });
}

console.log("plugin-install-dialog-test ok");
