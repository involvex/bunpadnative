/**
 * Document BOM and recent-file settings tests.
 * Run: bun run test:document
 */
import { join } from "node:path";
import { rm } from "node:fs/promises";

import { Document } from "../src/app/document";
import { SettingsStore } from "../src/app/settings";

const tmpDir = join(process.cwd(), ".tmp-document-test");
const bomPath = join(tmpDir, "bom.txt");
const plainPath = join(tmpDir, "plain.txt");
const settingsPath = join(tmpDir, "settings.json");

await rm(tmpDir, { recursive: true, force: true });
await Bun.write(bomPath, "\uFEFFhello bom");
await Bun.write(plainPath, "hello plain");

const doc = new Document();
const bomText = await doc.readFromDisk(bomPath);
if (bomText !== "hello bom") {
  throw new Error(`Expected BOM text without prefix, got: ${bomText}`);
}
if (!doc.utf8Bom) {
  throw new Error("Expected utf8Bom=true after reading BOM file");
}

await doc.writeToDisk(bomPath, "saved bom");
const bomBytes = new Uint8Array(await Bun.file(bomPath).arrayBuffer());
if (bomBytes[0] !== 0xef || bomBytes[1] !== 0xbb || bomBytes[2] !== 0xbf) {
  throw new Error("Expected UTF-8 BOM to be preserved on save");
}

doc.reset();
const plainText = await doc.readFromDisk(plainPath);
if (plainText !== "hello plain") {
  throw new Error(`Unexpected plain text: ${plainText}`);
}
if (doc.utf8Bom) {
  throw new Error("Expected utf8Bom=false for plain file");
}

const settings = new SettingsStore(settingsPath);
await settings.load();
await settings.addRecentFile("C:\\alpha.txt");
await settings.addRecentFile("C:\\beta.txt");
await settings.addRecentFile("C:\\alpha.txt");

if (settings.recentFiles.length !== 2) {
  throw new Error(
    `Expected 2 recent files, got ${settings.recentFiles.length}`,
  );
}
if (settings.recentFiles[0] !== "C:\\alpha.txt") {
  throw new Error("Expected most recent file first");
}

await rm(tmpDir, { recursive: true, force: true });
console.log("document-test ok");
