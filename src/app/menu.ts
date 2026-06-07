import User32 from "@bun-win32/user32";

import { encodeWide } from "../win32/strings";

/** Win32 menu item flags (not exported by @bun-win32/user32). */
const MF_STRING = 0x0000;
const MF_POPUP = 0x0010;
const MF_SEPARATOR = 0x0800;

/** ACCEL.fVirt — virtual-key + Ctrl modifier. */
const FVIRTKEY = 0x01;
const FCONTROL = 0x08;

/** ACCEL is 6 bytes: fVirt(1) + pad(1) + key(2) + cmd(2). */
const ACCEL_SIZE = 6;

export enum MenuCommand {
  FileNew = 1001,
  FileOpen = 1002,
  FileSave = 1003,
  FileSaveAs = 1004,
  FileExit = 1005,
  EditSelectAll = 1101,
}

export type AppMenu = {
  menuBar: bigint;
  accelTable: bigint;
  /** Retain wide-string buffers for menu labels. */
  retain: Buffer[];
};

const packAccel = (
  buf: Buffer,
  index: number,
  key: number,
  command: MenuCommand,
): void => {
  const offset = index * ACCEL_SIZE;
  buf.writeUInt8(FVIRTKEY | FCONTROL, offset);
  buf.writeUInt16LE(key, offset + 2);
  buf.writeUInt16LE(command, offset + 4);
};

/** Build File/Edit menu bar and keyboard accelerator table. */
export const createAppMenu = (): AppMenu => {
  const retain: Buffer[] = [];

  const label = (text: string): Buffer => {
    const buf = encodeWide(text);
    retain.push(buf);
    return buf;
  };

  const fileMenu = User32.CreateMenu();
  const editMenu = User32.CreateMenu();
  const menuBar = User32.CreateMenu();

  if (!fileMenu || !editMenu || !menuBar) {
    throw new Error("CreateMenu failed");
  }

  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileNew),
    label("&New").ptr!,
  );
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileOpen),
    label("&Open...").ptr!,
  );
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileSave),
    label("&Save").ptr!,
  );
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileSaveAs),
    label("Save &As...").ptr!,
  );
  User32.AppendMenuW(fileMenu, MF_SEPARATOR, 0n, null);
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileExit),
    label("E&xit").ptr!,
  );

  User32.AppendMenuW(
    editMenu,
    MF_STRING,
    BigInt(MenuCommand.EditSelectAll),
    label("Select &All").ptr!,
  );

  User32.AppendMenuW(
    menuBar,
    MF_POPUP,
    fileMenu,
    label("&File").ptr!,
  );
  User32.AppendMenuW(
    menuBar,
    MF_POPUP,
    editMenu,
    label("&Edit").ptr!,
  );

  const accelBuf = Buffer.alloc(ACCEL_SIZE * 4);
  packAccel(accelBuf, 0, 0x4e, MenuCommand.FileNew);
  packAccel(accelBuf, 1, 0x4f, MenuCommand.FileOpen);
  packAccel(accelBuf, 2, 0x53, MenuCommand.FileSave);
  packAccel(accelBuf, 3, 0x41, MenuCommand.EditSelectAll);

  const accelTable = User32.CreateAcceleratorTableW(accelBuf.ptr!, 4);
  if (!accelTable) {
    throw new Error("CreateAcceleratorTableW failed");
  }

  retain.push(accelBuf);

  return { menuBar, accelTable, retain };
};
