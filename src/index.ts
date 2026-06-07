import "@bun-win32/core";

import { join } from "node:path";

import { assertReadableFile, resolveStartupFile } from "./app/cli";
import { getAppRoot } from "./app/paths";
import { SettingsStore } from "./app/settings";
import { MainWindow } from "./app/window";
import { ExtensionHost } from "./extensions/host";
import { runMessagePump } from "./loop/messageLoop";
import { PluginHost } from "./plugins/host";
import { ThemeController } from "./theme/controller";
import { ThemeManager } from "./theme/manager";

const appData =
  process.env.APPDATA ??
  join(process.env.USERPROFILE ?? "", "AppData", "Roaming");

const appRoot = getAppRoot();
const settingsPath = join(appData, "BunPad", "settings.json");

const settingsStore = new SettingsStore(settingsPath);
await settingsStore.load();

const themeManager = new ThemeManager(
  join(appRoot, "themes"),
  join(appData, "BunPad", "themes"),
  settingsStore,
);
await themeManager.init();

const themeController = new ThemeController(themeManager);
console.log(`[themes] active: ${themeController.current().name}`);

const pluginHost = new PluginHost(join(appRoot, "plugins"));
const pluginsLoaded = await pluginHost.loadAll();
console.log(`[plugins] ${pluginsLoaded} plugin(s) ready`);

const extensionHost = new ExtensionHost(join(appRoot, "extensions"), appRoot);
const extensionsLoaded = await extensionHost.loadAll();
console.log(`[extensions] ${extensionsLoaded} VS Code extension(s) discovered`);

const startupFile = await resolveStartupFile();
if (startupFile) {
  assertReadableFile(startupFile);
  console.log(`[cli] opening ${startupFile}`);
}

const win = MainWindow.create({
  title: "BunPad Native",
  width: 1024,
  height: 768,
  pluginHost,
  themeController,
  extensionHost,
  settingsStore,
  initialFile: startupFile ?? undefined,
});

let running = true;
win.onClose = () => {
  running = false;
};

console.log("BunPad Native — Phase 6");

await runMessagePump(() => running, win.pumpContext);
win.destroy();
