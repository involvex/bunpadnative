import { dirname } from "node:path";

/** True when running as a Bun-compiled standalone executable. */
export function isCompiledExecutable(): boolean {
  const exec = process.execPath.replace(/\\/g, "/").toLowerCase();
  return !exec.endsWith("/bun.exe") && !exec.endsWith("/bun");
}

/**
 * Directory containing runtime assets (themes, plugins, extensions, vscode-shim).
 * Dev: project cwd. Packaged: folder containing bunpad.exe.
 */
export function getAppRoot(): string {
  if (isCompiledExecutable()) {
    return dirname(process.execPath);
  }

  return process.cwd();
}
