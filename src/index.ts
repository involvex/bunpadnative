import { join } from "node:path";

import { MainWindow } from "./app/window";
import { runMessagePump } from "./loop/messageLoop";
import { PluginHost } from "./plugins/host";

const pluginHost = new PluginHost(join(process.cwd(), "plugins"));
const loaded = await pluginHost.loadAll();
console.log(`[plugins] ${loaded} plugin(s) ready`);

const win = MainWindow.create({
  title: "BunPad Native",
  width: 1024,
  height: 768,
  pluginHost,
});

let running = true;
win.onClose = () => {
  running = false;
};

console.log("BunPad Native — Phase 3");

await runMessagePump(() => running, win.pumpContext);
win.destroy();
