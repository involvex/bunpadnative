/**
 * Menu structure verification.
 * Run: bun run test:menu
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import { createAppMenus, MenuCommand } from "../src/app/menu";
import { ExtensionMenuCommand } from "../src/extensions/host";
import { ThemeManager } from "../src/theme/manager";

const themeManager = new ThemeManager(
  join(process.cwd(), "themes"),
  join(process.cwd(), ".tmp-themes"),
  join(process.cwd(), ".tmp-settings-menu.json"),
);
await themeManager.init();

const menus = createAppMenus(themeManager.summaries, []);

const fileCount = User32.GetMenuItemCount(menus.fileMenu);
if (fileCount !== 6) {
  throw new Error(`File menu expected 6 items, got ${fileCount}`);
}

const editCount = User32.GetMenuItemCount(menus.editMenu);
if (editCount !== 1) {
  throw new Error(`Edit menu expected 1 item, got ${editCount}`);
}

const viewCount = User32.GetMenuItemCount(menus.viewMenu);
const themeCount = themeManager.summaries.length;
if (viewCount < 3) {
  throw new Error(`View menu expected at least 3 items, got ${viewCount}`);
}

const pluginsCount = User32.GetMenuItemCount(menus.pluginsMenu);
if (pluginsCount < 2) {
  throw new Error(
    `Plugins menu expected at least 2 items, got ${pluginsCount}`,
  );
}

if (!menus.accelTable) {
  throw new Error("Accelerator table was not created");
}

const ids = [
  MenuCommand.FileNew,
  MenuCommand.FileOpen,
  MenuCommand.FileSave,
  MenuCommand.FileSaveAs,
  MenuCommand.FileExit,
  MenuCommand.EditSelectAll,
  MenuCommand.ViewReloadThemes,
  MenuCommand.ViewOpenThemesFolder,
  MenuCommand.PluginsReload,
  ExtensionMenuCommand.Reload,
];

for (const id of ids) {
  if (id <= 0) {
    throw new Error(`Invalid menu command id: ${id}`);
  }
}

console.log("menu-test ok");
console.log(
  `  file=${fileCount} edit=${editCount} view=${viewCount} plugins=${pluginsCount} themes=${themeCount}`,
);
