import type { Stats } from "node:fs";
import { stat as fsStat } from "node:fs/promises";

import { FileType, Uri, type FileStat } from "./types";

const toFileType = (fileStat: Stats): FileType => {
  if (fileStat.isDirectory()) {
    return FileType.Directory;
  }
  if (fileStat.isFile()) {
    return FileType.File;
  }
  if (fileStat.isSymbolicLink()) {
    return FileType.SymbolicLink;
  }
  return FileType.Unknown;
};

/** VS Code workspace.fs backed by Bun file APIs. */
export const workspaceFs = {
  async readFile(uri: Uri): Promise<Uint8Array> {
    const data = await Bun.file(uri.fsPath).arrayBuffer();
    return new Uint8Array(data);
  },

  async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
    await Bun.write(uri.fsPath, content);
  },

  async stat(uri: Uri): Promise<FileStat> {
    const fileStat = await fsStat(uri.fsPath);
    return {
      type: toFileType(fileStat),
      ctime: fileStat.ctimeMs,
      mtime: fileStat.mtimeMs,
      size: fileStat.size,
    };
  },

  async readDirectory(uri: Uri): Promise<Array<[string, FileType]>> {
    const glob = new Bun.Glob("*");
    const entries: Array<[string, FileType]> = [];

    for await (const name of glob.scan({ cwd: uri.fsPath, onlyFiles: false })) {
      const child = Uri.file(`${uri.fsPath}/${name}`);
      try {
        const childStat = await workspaceFs.stat(child);
        entries.push([name, childStat.type]);
      } catch {
        entries.push([name, FileType.Unknown]);
      }
    }

    return entries;
  },
};
