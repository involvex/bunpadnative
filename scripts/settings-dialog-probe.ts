/**
 * Probe settings dialog open/close lifecycle.
 * Run: bun run scripts/settings-dialog-probe.ts
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import { SettingsStore } from "../src/app/settings";
import { MainWindow } from "../src/app/window";
import {
  showSettingsDialog,
  closeActiveSettingsDialog,
  isSettingsDialogOpen,
} from "../src/io/settingsDialog";
import { pumpOnce } from "../src/loop/messageLoop";
import { ExtensionHost } from "../src/extensions/host";
import { ThemeController } from "../src/theme/controller";
import { ThemeManager } from "../src/theme/manager";

process.env.BUNPAD_TEST = "1";

const settings = new SettingsStore(
  join(process.cwd(), ".tmp-settings-dialog-probe.json"),
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
  title: "Settings Dialog Probe",
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

const dialogPromise = showSettingsDialog(win.handle, settings.editor);

for (let i = 0; i < 30; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

if (!isSettingsDialogOpen()) {
  win.destroy();
  throw new Error("Settings dialog did not open");
}

closeActiveSettingsDialog();

for (let i = 0; i < 30; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

const result = await Promise.race([
  dialogPromise,
  Bun.sleep(2000).then(() => "timeout" as const),
]);

win.destroy();

if (result === "timeout") {
  throw new Error("Settings dialog did not close within 2s");
}

console.log("settings-dialog-probe ok");
