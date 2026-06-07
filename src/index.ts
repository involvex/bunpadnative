import "@bun-win32/core";

import { join } from "node:path";

import { getAppRoot } from "./app/paths";
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

const themeManager = new ThemeManager(
  join(appRoot, "themes"),
  join(appData, "BunPad", "themes"),
  join(appData, "BunPad", "settings.json"),
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

const win = MainWindow.create({
  title: "BunPad Native",
  width: 1024,
  height: 768,
  pluginHost,
  themeController,
  extensionHost,
});

let running = true;
win.onClose = () => {
  running = false;
};

console.log("BunPad Native — Phase 5");

await runMessagePump(() => running, win.pumpContext);
win.destroy();
