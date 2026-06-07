/**
 * CLI startup path parsing tests.
 * Run: bun run scripts/cli-test.ts
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { parseStartupFilePath, resolveStartupFile } from "../src/app/cli";

const tmp = mkdtempSync(join(tmpdir(), "bunpad-cli-"));
const sample = join(tmp, "sample.ts");
writeFileSync(sample, "export {};\n");

if (parseStartupFilePath(["bunpad", sample]) !== sample) {
  throw new Error("Expected absolute path from CLI arg");
}

const relative = parseStartupFilePath(["bunpad", "sample.ts"]);
if (!relative || !relative.endsWith("sample.ts")) {
  throw new Error(`Expected resolved relative path, got ${relative}`);
}

if (parseStartupFilePath(["bun", "src/index.ts", sample]) !== sample) {
  throw new Error("Expected to skip bun runner and script path");
}

if (parseStartupFilePath(["bunpad", "-h"]) !== null) {
  throw new Error("Expected flags to be ignored");
}

const savedArgv = process.argv;
const savedIsTTY = process.stdin.isTTY;

try {
  process.argv = ["bunpad"];
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  if ((await resolveStartupFile()) !== null) {
    throw new Error("Expected null when no args and TTY stdin");
  }

  process.argv = ["bunpad", sample];
  if ((await resolveStartupFile()) !== sample) {
    throw new Error("Expected argv path to win over stdin");
  }
} finally {
  process.argv = savedArgv;
  Object.defineProperty(process.stdin, "isTTY", {
    value: savedIsTTY,
    configurable: true,
  });
}

console.log("cli-test ok");
