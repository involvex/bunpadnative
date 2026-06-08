/**
 * Menu structure verification.
 * Run: bun run test:menu
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import {
  createAppMenus,
  languageModeForCommand,
  MenuCommand,
} from "../src/app/menu";
import { SettingsStore } from "../src/app/settings";
import { ExtensionMenuCommand } from "../src/extensions/host";
import { ThemeManager } from "../src/theme/manager";

const settings = new SettingsStore(
  join(process.cwd(), ".tmp-settings-menu.json"),
);
await settings.load();

const themeManager = new ThemeManager(
  join(process.cwd(), "themes"),
  join(process.cwd(), ".tmp-themes"),
  settings,
);
await themeManager.init();

const menus = createAppMenus(themeManager.summaries, settings.recentFiles, []);

const fileCount = User32.GetMenuItemCount(menus.fileMenu);
if (fileCount !== 8) {
  throw new Error(`File menu expected 8 items, got ${fileCount}`);
}

const editCount = User32.GetMenuItemCount(menus.editMenu);
if (editCount !== 11) {
  throw new Error(`Edit menu expected 11 items, got ${editCount}`);
}

const viewCount = User32.GetMenuItemCount(menus.viewMenu);
const settingsCount = User32.GetMenuItemCount(menus.settingsMenu);
const themeCount = themeManager.summaries.length;
if (viewCount !== 1) {
  throw new Error(
    `View menu expected 1 item (Language Mode), got ${viewCount}`,
  );
}
if (settingsCount !== 9) {
  throw new Error(`Settings menu expected 9 items, got ${settingsCount}`);
}

const themeMenuCount = User32.GetMenuItemCount(menus.themeMenu);
const expectedThemeItems = themeCount + 4;
if (themeMenuCount !== expectedThemeItems) {
  throw new Error(
    `Theme submenu expected ${expectedThemeItems} items, got ${themeMenuCount}`,
  );
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

const contextCount = User32.GetMenuItemCount(menus.contextMenu);
if (contextCount !== 8) {
  throw new Error(`Context menu expected 8 items, got ${contextCount}`);
}

const ids = [
  MenuCommand.FileNew,
  MenuCommand.FileOpen,
  MenuCommand.FileSave,
  MenuCommand.FileSaveAs,
  MenuCommand.FileExit,
  MenuCommand.EditUndo,
  MenuCommand.EditRedo,
  MenuCommand.EditCut,
  MenuCommand.EditCopy,
  MenuCommand.EditPaste,
  MenuCommand.EditFind,
  MenuCommand.EditReplace,
  MenuCommand.EditSelectAll,
  MenuCommand.ViewReloadThemes,
  MenuCommand.ViewOpenThemesFolder,
  MenuCommand.SettingsPreferences,
  MenuCommand.SettingsImportTheme,
  MenuCommand.SettingsInstallPlugin,
  MenuCommand.SettingsImportExtension,
  MenuCommand.SettingsOpenPluginsFolder,
  MenuCommand.SettingsOpenExtensionsFolder,
  MenuCommand.SettingsInstallFromMarketplace,
  MenuCommand.LanguageAuto,
  MenuCommand.LanguagePlain,
  MenuCommand.LanguageJson,
  MenuCommand.LanguageTypescript,
  MenuCommand.LanguageMarkdown,
  MenuCommand.PluginsReload,
  ExtensionMenuCommand.Reload,
];

for (const id of ids) {
  if (id <= 0) {
    throw new Error(`Invalid menu command id: ${id}`);
  }
}

if (languageModeForCommand(MenuCommand.LanguageJson) !== "json") {
  throw new Error("languageModeForCommand failed for JSON");
}

if (languageModeForCommand(MenuCommand.FileNew) !== null) {
  throw new Error(
    "languageModeForCommand should return null for non-language ids",
  );
}

console.log("menu-test ok");
console.log(
  `  file=${fileCount} edit=${editCount} view=${viewCount} settings=${settingsCount} plugins=${pluginsCount} themes=${themeCount}`,
);
