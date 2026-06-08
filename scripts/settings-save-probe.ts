/**
 * Probe OK/save path for preferences dialog (guards against wndProc UAF crash).
 * Run: bun run scripts/settings-save-probe.ts
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import { SettingsStore } from "../src/app/settings";
import { MainWindow } from "../src/app/window";
import {
  isSettingsDialogOpen,
  getActiveSettingsDialogHwnd,
} from "../src/io/settingsDialog";
import { pumpOnce } from "../src/loop/messageLoop";
import { ExtensionHost } from "../src/extensions/host";
import { ThemeController } from "../src/theme/controller";
import { ThemeManager } from "../src/theme/manager";
import { MenuCommand } from "../src/app/menu";
import { WM_APP_DEFER_COMMAND, WM_COMMAND } from "../src/win32/constants";

process.env.BUNPAD_TEST = "1";

const settings = new SettingsStore(
  join(process.cwd(), ".tmp-settings-save-probe.json"),
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
  title: "Settings Save Probe",
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

for (let i = 0; i < 40; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
  if (!isSettingsDialogOpen()) {
    break;
  }
}

if (!isSettingsDialogOpen()) {
  win.destroy();
  throw new Error("Preferences dialog did not open");
}

const dialogHwnd = getActiveSettingsDialogHwnd();
User32.SendMessageW(dialogHwnd, WM_COMMAND, 1n, 0n);

for (let i = 0; i < 40; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

if (isSettingsDialogOpen()) {
  win.destroy();
  throw new Error("Preferences dialog stayed open after OK");
}

if (!User32.IsWindowEnabled(win.handle)) {
  win.destroy();
  throw new Error("Owner window stayed disabled after save");
}

win.destroy();
console.log("settings-save-probe ok");
