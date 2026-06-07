/**
 * Smoke test: editor I/O, themed chrome, programmatic close.
 * Run: bun run scripts/smoke-test.ts
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import { SettingsStore } from "../src/app/settings";
import { MainWindow } from "../src/app/window";
import { pumpOnce } from "../src/loop/messageLoop";
import { ExtensionHost } from "../src/extensions/host";
import { ThemeController } from "../src/theme/controller";
import { ThemeManager } from "../src/theme/manager";
import { WM_CLOSE } from "../src/win32/constants";

process.env.BUNPAD_TEST = "1";

const settings = new SettingsStore(
  join(process.cwd(), ".tmp-settings-smoke.json"),
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
  title: "BunPad Smoke Test",
  width: 640,
  height: 480,
  themeController,
  extensionHost,
  settingsStore: settings,
});
const ctx = win.pumpContext;

let running = true;
win.onClose = () => {
  running = false;
};

for (let i = 0; i < 5; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

win.editor?.setText("BunPad Phase 6 smoke test");
win.document.setBaseline(win.editor?.getText() ?? "");
pumpOnce(ctx);

const readBack = win.editor?.getText() ?? "";
if (!readBack.includes("BunPad Phase 6")) {
  throw new Error(`Unexpected editor text: ${readBack}`);
}

User32.PostMessageW(win.handle, WM_CLOSE, 0n, 0n);

const deadline = Date.now() + 3000;
while (running && Date.now() < deadline) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

if (running) {
  win.destroy();
  throw new Error("Window did not close within 3s");
}

win.destroy();
console.log("smoke-test ok");
