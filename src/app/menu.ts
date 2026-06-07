import User32 from "@bun-win32/user32";

import { MAX_RECENT_FILES } from "./settings";
import type { ExtensionCommand } from "../extensions/host";
import { ExtensionMenuCommand } from "../extensions/host";
import type { ThemeSummary } from "../theme/types";
import type { LanguageMode } from "../highlight/types";
import { encodeWide, ffiPtr } from "../win32/strings";

/** Win32 menu item flags (not exported by @bun-win32/user32). */
const MF_STRING = 0x0000;
const MF_POPUP = 0x0010;
const MF_SEPARATOR = 0x0800;
const MF_GRAYED = 0x0001;
const MF_BYPOSITION = 0x0400;

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
  EditUndo = 1102,
  EditRedo = 1103,
  EditCut = 1104,
  EditCopy = 1105,
  EditPaste = 1106,
  EditFind = 1107,
  EditReplace = 1108,
  EditSelectAll = 1101,
  PluginsReload = 1201,
  ThemeCommandBase = 1300,
  ViewReloadThemes = 1398,
  ViewOpenThemesFolder = 1399,
  FileRecentBase = 1500,
  FileClearRecent = 1510,
  LanguageAuto = 1600,
  LanguagePlain = 1601,
  LanguageJson = 1602,
  LanguageTypescript = 1603,
  LanguageMarkdown = 1604,
}

export type AppMenus = {
  fileMenu: bigint;
  editMenu: bigint;
  viewMenu: bigint;
  pluginsMenu: bigint;
  recentMenu: bigint;
  contextMenu: bigint;
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

const appendLabel = (retain: Buffer[], text: string): Buffer => {
  const buf = encodeWide(text);
  retain.push(buf);
  return buf;
};

/** Rebuild the recent-files submenu from persisted paths. */
export const populateRecentMenu = (
  recentMenu: bigint,
  recentFiles: readonly string[],
  retain: Buffer[],
): void => {
  let count = User32.GetMenuItemCount(recentMenu);
  while (count > 0) {
    User32.DeleteMenu(recentMenu, 0, MF_BYPOSITION);
    count -= 1;
  }

  if (recentFiles.length === 0) {
    User32.AppendMenuW(
      recentMenu,
      MF_STRING | MF_GRAYED,
      0n,
      ffiPtr(appendLabel(retain, "(No recent files)")),
    );
    return;
  }

  for (let index = 0; index < recentFiles.length; index += 1) {
    const path = recentFiles[index]!;
    const name = path.split(/[/\\]/).pop() ?? path;
    User32.AppendMenuW(
      recentMenu,
      MF_STRING,
      BigInt(MenuCommand.FileRecentBase + index),
      ffiPtr(appendLabel(retain, name)),
    );
  }

  User32.AppendMenuW(recentMenu, MF_SEPARATOR, 0n, null);
  User32.AppendMenuW(
    recentMenu,
    MF_STRING,
    BigInt(MenuCommand.FileClearRecent),
    ffiPtr(appendLabel(retain, "Clear Recent")),
  );
};

const buildContextMenu = (retain: Buffer[]): bigint => {
  const menu = User32.CreatePopupMenu();
  if (!menu) {
    throw new Error("CreatePopupMenu failed for context menu");
  }

  const item = (text: string, command: MenuCommand): void => {
    User32.AppendMenuW(
      menu,
      MF_STRING,
      BigInt(command),
      ffiPtr(appendLabel(retain, text)),
    );
  };

  item("Undo\tCtrl+Z", MenuCommand.EditUndo);
  item("Redo\tCtrl+Y", MenuCommand.EditRedo);
  User32.AppendMenuW(menu, MF_SEPARATOR, 0n, null);
  item("Cut\tCtrl+X", MenuCommand.EditCut);
  item("Copy\tCtrl+C", MenuCommand.EditCopy);
  item("Paste\tCtrl+V", MenuCommand.EditPaste);
  User32.AppendMenuW(menu, MF_SEPARATOR, 0n, null);
  item("Select All\tCtrl+A", MenuCommand.EditSelectAll);

  return menu;
};

/** Build popup menus and keyboard accelerator table for the custom menu bar. */
export const createAppMenus = (
  themes: ThemeSummary[],
  recentFiles: readonly string[],
  extensions: ExtensionCommand[] = [],
): AppMenus => {
  const retain: Buffer[] = [];

  const fileMenu = User32.CreatePopupMenu();
  const editMenu = User32.CreatePopupMenu();
  const viewMenu = User32.CreatePopupMenu();
  const themeMenu = User32.CreatePopupMenu();
  const languageMenu = User32.CreatePopupMenu();
  const pluginsMenu = User32.CreatePopupMenu();
  const recentMenu = User32.CreatePopupMenu();

  if (
    !fileMenu ||
    !editMenu ||
    !viewMenu ||
    !themeMenu ||
    !languageMenu ||
    !pluginsMenu ||
    !recentMenu
  ) {
    throw new Error("CreateMenu failed");
  }

  const item = (menu: bigint, text: string, command: MenuCommand): void => {
    User32.AppendMenuW(
      menu,
      MF_STRING,
      BigInt(command),
      ffiPtr(appendLabel(retain, text)),
    );
  };

  item(fileMenu, "&New", MenuCommand.FileNew);
  item(fileMenu, "&Open...", MenuCommand.FileOpen);
  item(fileMenu, "&Save", MenuCommand.FileSave);
  item(fileMenu, "Save &As...", MenuCommand.FileSaveAs);
  User32.AppendMenuW(fileMenu, MF_SEPARATOR, 0n, null);
  populateRecentMenu(recentMenu, recentFiles, retain);
  User32.AppendMenuW(
    fileMenu,
    MF_POPUP,
    recentMenu,
    ffiPtr(appendLabel(retain, "Recent &Files")),
  );
  User32.AppendMenuW(fileMenu, MF_SEPARATOR, 0n, null);
  item(fileMenu, "E&xit", MenuCommand.FileExit);

  item(editMenu, "&Undo", MenuCommand.EditUndo);
  item(editMenu, "&Redo", MenuCommand.EditRedo);
  User32.AppendMenuW(editMenu, MF_SEPARATOR, 0n, null);
  item(editMenu, "Cu&t", MenuCommand.EditCut);
  item(editMenu, "&Copy", MenuCommand.EditCopy);
  item(editMenu, "&Paste", MenuCommand.EditPaste);
  User32.AppendMenuW(editMenu, MF_SEPARATOR, 0n, null);
  item(editMenu, "&Find...", MenuCommand.EditFind);
  item(editMenu, "&Replace...", MenuCommand.EditReplace);
  User32.AppendMenuW(editMenu, MF_SEPARATOR, 0n, null);
  item(editMenu, "Select &All", MenuCommand.EditSelectAll);

  let command = MenuCommand.ThemeCommandBase;
  for (const theme of themes) {
    if (command > MenuCommand.ViewReloadThemes - 1) {
      break;
    }
    User32.AppendMenuW(
      themeMenu,
      MF_STRING,
      BigInt(command),
      ffiPtr(appendLabel(retain, theme.name)),
    );
    command += 1;
  }

  User32.AppendMenuW(
    viewMenu,
    MF_POPUP,
    themeMenu,
    ffiPtr(appendLabel(retain, "&Theme")),
  );
  User32.AppendMenuW(
    viewMenu,
    MF_POPUP,
    languageMenu,
    ffiPtr(appendLabel(retain, "&Language Mode")),
  );
  item(languageMenu, "&Auto Detect", MenuCommand.LanguageAuto);
  item(languageMenu, "&Plain Text", MenuCommand.LanguagePlain);
  item(languageMenu, "&JSON", MenuCommand.LanguageJson);
  item(languageMenu, "&TypeScript", MenuCommand.LanguageTypescript);
  item(languageMenu, "&Markdown", MenuCommand.LanguageMarkdown);

  item(viewMenu, "&Reload Themes", MenuCommand.ViewReloadThemes);
  item(viewMenu, "&Open Themes Folder...", MenuCommand.ViewOpenThemesFolder);

  item(pluginsMenu, "&Reload BunPad Plugins", MenuCommand.PluginsReload);
  User32.AppendMenuW(
    pluginsMenu,
    MF_STRING,
    BigInt(ExtensionMenuCommand.Reload),
    ffiPtr(appendLabel(retain, "&Reload VS Code Extensions")),
  );

  if (extensions.length > 0) {
    User32.AppendMenuW(pluginsMenu, MF_SEPARATOR, 0n, null);
    for (const extension of extensions) {
      User32.AppendMenuW(
        pluginsMenu,
        MF_STRING,
        BigInt(extension.menuCommandId),
        ffiPtr(appendLabel(retain, extension.title)),
      );
    }
  }

  const accelCount = 11;
  const accelBuf = Buffer.alloc(ACCEL_SIZE * accelCount);
  packAccel(accelBuf, 0, 0x4e, MenuCommand.FileNew);
  packAccel(accelBuf, 1, 0x4f, MenuCommand.FileOpen);
  packAccel(accelBuf, 2, 0x53, MenuCommand.FileSave);
  packAccel(accelBuf, 3, 0x41, MenuCommand.EditSelectAll);
  packAccel(accelBuf, 4, 0x5a, MenuCommand.EditUndo);
  packAccel(accelBuf, 5, 0x59, MenuCommand.EditRedo);
  packAccel(accelBuf, 6, 0x58, MenuCommand.EditCut);
  packAccel(accelBuf, 7, 0x43, MenuCommand.EditCopy);
  packAccel(accelBuf, 8, 0x56, MenuCommand.EditPaste);
  packAccel(accelBuf, 9, 0x46, MenuCommand.EditFind);
  packAccel(accelBuf, 10, 0x48, MenuCommand.EditReplace);

  const accelTable = User32.CreateAcceleratorTableW(
    ffiPtr(accelBuf),
    accelCount,
  );
  if (!accelTable) {
    throw new Error("CreateAcceleratorTableW failed");
  }

  retain.push(accelBuf);

  const contextMenu = buildContextMenu(retain);

  return {
    fileMenu,
    editMenu,
    viewMenu,
    pluginsMenu,
    recentMenu,
    contextMenu,
    accelTable,
    retain,
  };
};

export const recentPathForCommand = (
  commandId: number,
  recentFiles: readonly string[],
): string | null => {
  const index = commandId - MenuCommand.FileRecentBase;
  if (index < 0 || index >= MAX_RECENT_FILES) {
    return null;
  }
  return recentFiles[index] ?? null;
};

export const languageModeForCommand = (
  commandId: number,
): LanguageMode | null => {
  switch (commandId) {
    case MenuCommand.LanguageAuto:
      return "auto";
    case MenuCommand.LanguagePlain:
      return "plain";
    case MenuCommand.LanguageJson:
      return "json";
    case MenuCommand.LanguageTypescript:
      return "typescript";
    case MenuCommand.LanguageMarkdown:
      return "markdown";
    default:
      return null;
  }
};
