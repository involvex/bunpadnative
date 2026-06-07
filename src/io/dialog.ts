import Comdlg32, { OpenFileNameFlag } from "@bun-win32/comdlg32";

import { encodeWide, ffiPtr } from "../win32/strings";
import { pointerToBigInt } from "../win32/pointers";

const OPENFILENAMEW_SIZE = 152;
const PATH_BUF_CHARS = 1024;
const TITLE_BUF_CHARS = 260;

const TEXT_FILTER = Buffer.from(
  "Text Files (*.txt;*.md;*.ts;*.js)\0*.txt;*.md;*.ts;*.js;*.tsx;*.jsx;*.json\0All Files (*.*)\0*.*\0\0",
  "utf16le",
);

/** Pack OPENFILENAMEW (152 bytes, x64) for comdlg32 file pickers. */
const packOpenFileName = (
  owner: bigint,
  fileBuf: Buffer,
  fileTitleBuf: Buffer,
  title: Buffer,
  initialDir: Buffer | null,
  flags: number,
  defaultFile?: string,
): Buffer => {
  if (defaultFile) {
    fileBuf.write(defaultFile, 0, "utf16le");
  }

  const ofn = Buffer.alloc(OPENFILENAMEW_SIZE);
  const view = new DataView(ofn.buffer);

  view.setUint32(0x00, OPENFILENAMEW_SIZE, true);
  view.setBigUint64(0x08, owner, true);
  view.setBigUint64(0x18, pointerToBigInt(TEXT_FILTER), true);
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

/** Native GetOpenFileNameW; returns absolute path or null if cancelled. */
export const showOpenDialog = (
  owner: bigint,
  initialPath?: string | null,
): string | null => {
  const fileBuf = Buffer.alloc(PATH_BUF_CHARS * 2);
  const fileTitleBuf = Buffer.alloc(TITLE_BUF_CHARS * 2);
  const title = encodeWide("Open");
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
  );

  if (!Comdlg32.GetOpenFileNameW(ffiPtr(ofn))) {
    return null;
  }

  return readPath(fileBuf);
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
    initialPath ?? undefined,
  );

  if (!Comdlg32.GetSaveFileNameW(ffiPtr(ofn))) {
    return null;
  }

  return readPath(fileBuf);
};
