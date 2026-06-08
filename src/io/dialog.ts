import Comdlg32, { OpenFileNameFlag } from "@bun-win32/comdlg32";
import { dlopen, FFIType } from "bun:ffi";

import { encodeWide, ffiPtr } from "../win32/strings";
import { pointerToBigInt } from "../win32/pointers";

const OPENFILENAMEW_SIZE = 152;
const PATH_BUF_CHARS = 1024;
const TITLE_BUF_CHARS = 260;

const TEXT_FILTER = Buffer.from(
  "Text Files (*.txt;*.md;*.ts;*.js)\0*.txt;*.md;*.ts;*.js;*.tsx;*.jsx;*.json\0All Files (*.*)\0*.*\0\0",
  "utf16le",
);

const JSON_FILTER = Buffer.from(
  "Theme JSON (*.json)\0*.json\0All Files (*.*)\0*.*\0\0",
  "utf16le",
);

const PLUGIN_FILTER = Buffer.from(
  "BunPad Plugins (*.ts;*.js)\0*.ts;*.js;*.mts;*.mjs\0All Files (*.*)\0*.*\0\0",
  "utf16le",
);

const MANIFEST_FILTER = Buffer.from(
  "Extension Manifest (package.json)\0package.json\0All Files (*.*)\0*.*\0\0",
  "utf16le",
);

const shell32 = dlopen("shell32.dll", {
  SHBrowseForFolderW: {
    args: [FFIType.ptr],
    returns: FFIType.ptr,
  },
  SHGetPathFromIDListW: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.i32,
  },
});

const BIF_RETURNONLYFSDIRS = 0x0001;
const BIF_NEWDIALOGSTYLE = 0x0040;

/** Pack OPENFILENAMEW (152 bytes, x64) for comdlg32 file pickers. */
const packOpenFileName = (
  owner: bigint,
  fileBuf: Buffer,
  fileTitleBuf: Buffer,
  title: Buffer,
  initialDir: Buffer | null,
  flags: number,
  filter: Buffer,
  defaultFile?: string,
): Buffer => {
  if (defaultFile) {
    fileBuf.write(defaultFile, 0, "utf16le");
  }

  const ofn = Buffer.alloc(OPENFILENAMEW_SIZE);
  const view = new DataView(ofn.buffer);

  view.setUint32(0x00, OPENFILENAMEW_SIZE, true);
  view.setBigUint64(0x08, owner, true);
  view.setBigUint64(0x18, pointerToBigInt(filter), true);
  view.setUint32(0x2c, 1, true);
  view.setBigUint64(0x30, pointerToBigInt(fileBuf), true);
  view.setUint32(0x38, PATH_BUF_CHARS, true);
  view.setBigUint64(0x40, pointerToBigInt(fileTitleBuf), true);
  view.setUint32(0x48, TITLE_BUF_CHARS, true);

  if (initialDir) {
    view.setBigUint64(0x50, pointerToBigInt(initialDir), true);
  }

  view.setBigUint64(0x58, pointerToBigInt(title), true);
  view.setUint32(0x60, flags, true);

  const defExt = encodeWide("txt");
  view.setBigUint64(0x68, pointerToBigInt(defExt), true);

  return ofn;
};

const readPath = (fileBuf: Buffer): string =>
  fileBuf.toString("utf16le").replace(/\0.*$/, "");

const pickFile = (
  owner: bigint,
  titleText: string,
  initialPath: string | null | undefined,
  filter: Buffer,
): string | null => {
  const fileBuf = Buffer.alloc(PATH_BUF_CHARS * 2);
  const fileTitleBuf = Buffer.alloc(TITLE_BUF_CHARS * 2);
  const title = encodeWide(titleText);
  const initialDir = initialPath
    ? encodeWide(initialPath.replace(/[\\/][^\\/]+$/, "") || initialPath)
    : encodeWide(process.cwd());

  const ofn = packOpenFileName(
    owner,
    fileBuf,
    fileTitleBuf,
    title,
    initialDir,
    OpenFileNameFlag.OFN_EXPLORER |
      OpenFileNameFlag.OFN_FILEMUSTEXIST |
      OpenFileNameFlag.OFN_PATHMUSTEXIST |
      OpenFileNameFlag.OFN_HIDEREADONLY,
    filter,
  );

  if (!Comdlg32.GetOpenFileNameW(ffiPtr(ofn))) {
    return null;
  }

  return readPath(fileBuf);
};

/** Native GetOpenFileNameW; returns absolute path or null if cancelled. */
export const showOpenDialog = (
  owner: bigint,
  initialPath?: string | null,
): string | null => pickFile(owner, "Open", initialPath, TEXT_FILTER);

export const showOpenJsonDialog = (
  owner: bigint,
  initialPath?: string | null,
): string | null => pickFile(owner, "Import Theme", initialPath, JSON_FILTER);

export const showOpenPluginDialog = (
  owner: bigint,
  initialPath?: string | null,
): string | null =>
  pickFile(owner, "Install Plugin", initialPath, PLUGIN_FILTER);

export const showOpenManifestDialog = (
  owner: bigint,
  initialPath?: string | null,
): string | null =>
  pickFile(owner, "Import VS Code Extension", initialPath, MANIFEST_FILTER);

/** SHBrowseForFolderW folder picker; returns absolute path or null. */
export const showFolderDialog = (
  owner: bigint,
  titleText: string,
): string | null => {
  const displayName = Buffer.alloc(520);
  const title = encodeWide(titleText);
  const bi = Buffer.alloc(64);
  const view = new DataView(bi.buffer);

  view.setBigUint64(0, owner, true);
  view.setBigUint64(8, 0n, true);
  view.setBigUint64(16, pointerToBigInt(displayName), true);
  view.setBigUint64(24, pointerToBigInt(title), true);
  view.setUint32(32, BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE, true);
  view.setBigUint64(40, 0n, true);
  view.setBigUint64(48, 0n, true);
  view.setInt32(56, 0, true);

  const pidl = shell32.symbols.SHBrowseForFolderW(
    pointerToBigInt(bi) as unknown as never,
  );
  if (!pidl) {
    return null;
  }

  const pathBuf = Buffer.alloc(PATH_BUF_CHARS * 2);
  const ok = shell32.symbols.SHGetPathFromIDListW(
    pidl,
    pointerToBigInt(pathBuf) as unknown as never,
  );
  if (!ok) {
    return null;
  }

  return readPath(pathBuf);
};

/** Native GetSaveFileNameW; returns absolute path or null if cancelled. */
export const showSaveDialog = (
  owner: bigint,
  initialPath?: string | null,
): string | null => {
  const fileBuf = Buffer.alloc(PATH_BUF_CHARS * 2);
  const fileTitleBuf = Buffer.alloc(TITLE_BUF_CHARS * 2);
  const title = encodeWide("Save As");
  const initialDir = initialPath
    ? encodeWide(initialPath.replace(/[\\/][^\\/]+$/, "") || initialPath)
    : encodeWide(process.cwd());

  const ofn = packOpenFileName(
    owner,
    fileBuf,
    fileTitleBuf,
    title,
    initialDir,
    OpenFileNameFlag.OFN_EXPLORER |
      OpenFileNameFlag.OFN_OVERWRITEPROMPT |
      OpenFileNameFlag.OFN_HIDEREADONLY |
      OpenFileNameFlag.OFN_PATHMUSTEXIST,
    TEXT_FILTER,
    initialPath ?? undefined,
  );

  if (!Comdlg32.GetSaveFileNameW(ffiPtr(ofn))) {
    return null;
  }

  return readPath(fileBuf);
};
