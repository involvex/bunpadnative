import User32 from "@bun-win32/user32";

import type { ExtensionCommand } from "../extensions/host";
import { ExtensionMenuCommand } from "../extensions/host";
import type { ThemeSummary } from "../theme/types";
import { encodeWide, ffiPtr } from "../win32/strings";

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
  PluginsReload = 1201,
  ThemeCommandBase = 1300,
  ViewReloadThemes = 1398,
  ViewOpenThemesFolder = 1399,
}

export type AppMenus = {
  fileMenu: bigint;
  editMenu: bigint;
  viewMenu: bigint;
  pluginsMenu: bigint;
  accelTable: bigint;
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

/** Build popup menus and keyboard accelerator table for the custom menu bar. */
export const createAppMenus = (
  themes: ThemeSummary[],
  extensions: ExtensionCommand[] = [],
): AppMenus => {
  const retain: Buffer[] = [];

  const label = (text: string): Buffer => {
    const buf = encodeWide(text);
    retain.push(buf);
    return buf;
  };

  const fileMenu = User32.CreatePopupMenu();
  const editMenu = User32.CreatePopupMenu();
  const viewMenu = User32.CreatePopupMenu();
  const themeMenu = User32.CreatePopupMenu();
  const pluginsMenu = User32.CreatePopupMenu();

  if (!fileMenu || !editMenu || !viewMenu || !themeMenu || !pluginsMenu) {
    throw new Error("CreateMenu failed");
  }

  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileNew),
    ffiPtr(label("&New")),
  );
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileOpen),
    ffiPtr(label("&Open...")),
  );
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileSave),
    ffiPtr(label("&Save")),
  );
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileSaveAs),
    ffiPtr(label("Save &As...")),
  );
  User32.AppendMenuW(fileMenu, MF_SEPARATOR, 0n, null);
  User32.AppendMenuW(
    fileMenu,
    MF_STRING,
    BigInt(MenuCommand.FileExit),
    ffiPtr(label("E&xit")),
  );

  User32.AppendMenuW(
    editMenu,
    MF_STRING,
    BigInt(MenuCommand.EditSelectAll),
    ffiPtr(label("Select &All")),
  );

  let command = MenuCommand.ThemeCommandBase;
  for (const theme of themes) {
    if (command > MenuCommand.ViewReloadThemes - 1) {
      break;
    }
    User32.AppendMenuW(
      themeMenu,
      MF_STRING,
      BigInt(command),
      ffiPtr(label(theme.name)),
    );
    command += 1;
  }

  User32.AppendMenuW(viewMenu, MF_POPUP, themeMenu, ffiPtr(label("&Theme")));
  User32.AppendMenuW(
    viewMenu,
    MF_STRING,
    BigInt(MenuCommand.ViewReloadThemes),
    ffiPtr(label("&Reload Themes")),
  );
  User32.AppendMenuW(
    viewMenu,
    MF_STRING,
    BigInt(MenuCommand.ViewOpenThemesFolder),
    ffiPtr(label("&Open Themes Folder...")),
  );

  User32.AppendMenuW(
    pluginsMenu,
    MF_STRING,
    BigInt(MenuCommand.PluginsReload),
    ffiPtr(label("&Reload BunPad Plugins")),
  );
  User32.AppendMenuW(
    pluginsMenu,
    MF_STRING,
    BigInt(ExtensionMenuCommand.Reload),
    ffiPtr(label("&Reload VS Code Extensions")),
  );

  if (extensions.length > 0) {
    User32.AppendMenuW(pluginsMenu, MF_SEPARATOR, 0n, null);
    for (const extension of extensions) {
      User32.AppendMenuW(
        pluginsMenu,
        MF_STRING,
        BigInt(extension.menuCommandId),
        ffiPtr(label(extension.title)),
      );
    }
  }

  const accelBuf = Buffer.alloc(ACCEL_SIZE * 4);
  packAccel(accelBuf, 0, 0x4e, MenuCommand.FileNew);
  packAccel(accelBuf, 1, 0x4f, MenuCommand.FileOpen);
  packAccel(accelBuf, 2, 0x53, MenuCommand.FileSave);
  packAccel(accelBuf, 3, 0x41, MenuCommand.EditSelectAll);

  const accelTable = User32.CreateAcceleratorTableW(ffiPtr(accelBuf), 4);
  if (!accelTable) {
    throw new Error("CreateAcceleratorTableW failed");
  }

  retain.push(accelBuf);

  return {
    fileMenu,
    editMenu,
    viewMenu,
    pluginsMenu,
    accelTable,
    retain,
  };
};
