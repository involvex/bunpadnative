/**
 * Phase 5 packaging: compile bunpad.exe and stage runtime assets in dist/.
 * Run: bun run build
 */
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const outfile = join(dist, "bunpad.exe");

const copyDir = async (from: string, to: string): Promise<void> => {
  await cp(from, to, {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });
};

console.log("[build] cleaning dist/");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

console.log("[build] compiling bunpad.exe");
const compile = Bun.spawnSync(
  [
    process.execPath,
    "build",
    join(root, "src/index.ts"),
    "--compile",
    "--outfile",
    outfile,
    "--target",
    "bun-windows-x64",
  ],
  {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  },
);

if (compile.exitCode !== 0) {
  process.exit(compile.exitCode ?? 1);
}

console.log("[build] copying runtime assets");
await Promise.all([
  copyDir(join(root, "themes"), join(dist, "themes")),
  copyDir(join(root, "plugins"), join(dist, "plugins")),
  copyDir(join(root, "extensions"), join(dist, "extensions")),
  copyDir(join(root, "vscode-shim"), join(dist, "vscode-shim")),
  copyDir(join(root, "src/vscode"), join(dist, "src/vscode")),
  copyDir(join(root, "src/win32"), join(dist, "src/win32")),
]);

console.log(`[build] done: ${outfile}`);
