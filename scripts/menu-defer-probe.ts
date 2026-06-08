/**
 * Simulate Settings → Preferences via deferred menu command.
 * Run: bun run scripts/menu-defer-probe.ts
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import { MenuCommand } from "../src/app/menu";
import { SettingsStore } from "../src/app/settings";
import { MainWindow } from "../src/app/window";
import {
  closeActiveSettingsDialog,
  isSettingsDialogOpen,
} from "../src/io/settingsDialog";
import { pumpOnce } from "../src/loop/messageLoop";
import { ExtensionHost } from "../src/extensions/host";
import { ThemeController } from "../src/theme/controller";
import { ThemeManager } from "../src/theme/manager";
import { WM_APP_DEFER_COMMAND } from "../src/win32/constants";

process.env.BUNPAD_TEST = "1";

const settings = new SettingsStore(
  join(process.cwd(), ".tmp-menu-defer-probe.json"),
);
await settings.load();

const themeManager = new ThemeManager(
  join(process.cwd(), "themes"),
  join(process.cwd(), ".tmp-themes"),
  settings,
);
await themeManager.init();

const themeController = new ThemeController(themeManager);
const extensionHost = new ExtensionHost(join(process.cwd(), "extensions"));
await extensionHost.loadAll();

const win = MainWindow.create({
  title: "Menu Defer Probe",
  width: 800,
  height: 600,
  themeController,
  extensionHost,
  settingsStore: settings,
});
const ctx = win.pumpContext;

for (let i = 0; i < 10; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

User32.SetForegroundWindow(win.handle);

User32.PostMessageW(
  win.handle,
  WM_APP_DEFER_COMMAND,
  BigInt(MenuCommand.SettingsPreferences),
  0n,
);

for (let i = 0; i < 60; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

if (!isSettingsDialogOpen()) {
  win.destroy();
  throw new Error("Preferences dialog did not open from deferred menu command");
}

closeActiveSettingsDialog();

for (let i = 0; i < 30; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

if (isSettingsDialogOpen()) {
  win.destroy();
  throw new Error("Preferences dialog did not close");
}

if (!User32.IsWindowEnabled(win.handle)) {
  win.destroy();
  throw new Error("Owner window stayed disabled after dialog close");
}

win.destroy();
console.log("menu-defer-probe ok");
