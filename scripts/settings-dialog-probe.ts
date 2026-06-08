/**
 * Probe settings dialog geometry and child window creation.
 * Run: bun run scripts/settings-dialog-probe.ts
 */
import { join } from "node:path";

import User32 from "@bun-win32/user32";

import { SettingsStore } from "../src/app/settings";
import { MainWindow } from "../src/app/window";
import { agentLog } from "../src/debug/agentLog";
import {
  showSettingsDialog,
  closeActiveSettingsDialog,
} from "../src/io/settingsDialog";
import { pumpOnce } from "../src/loop/messageLoop";
import { ExtensionHost } from "../src/extensions/host";
import { ThemeController } from "../src/theme/controller";
import { ThemeManager } from "../src/theme/manager";
import { ffiPtr } from "../src/win32/strings";

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

agentLog(
  "settings-dialog-probe.ts",
  "Opening settings dialog programmatically",
  { owner: String(win.handle) },
  "H2",
  "probe",
);

const dialogPromise = showSettingsDialog(win.handle, settings.editor);

for (let i = 0; i < 30; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

const ownerEnabled = User32.IsWindowEnabled(win.handle) !== 0;
const foreground = User32.GetForegroundWindow();

const foundDialogs: Array<Record<string, unknown>> = [];
let probe = foreground;
for (let i = 0; i < 20 && probe; i += 1) {
  const rect = Buffer.alloc(16);
  User32.GetWindowRect(probe, ffiPtr(rect));
  const title = Buffer.alloc(512);
  User32.GetWindowTextW(probe, ffiPtr(title), 256);
  const titleText = title.toString("utf16le").replace(/\0.*$/, "");
  const clientRect = Buffer.alloc(16);
  User32.GetClientRect(probe, ffiPtr(clientRect));
  const visible = User32.IsWindowVisible(probe) !== 0;
  foundDialogs.push({
    hwnd: String(probe),
    title: titleText,
    visible,
    windowRect: {
      left: rect.readInt32LE(0),
      top: rect.readInt32LE(4),
      right: rect.readInt32LE(8),
      bottom: rect.readInt32LE(12),
    },
    clientRect: {
      right: clientRect.readInt32LE(8),
      bottom: clientRect.readInt32LE(12),
    },
  });
  probe = User32.GetWindow(probe, 2);
}

agentLog(
  "settings-dialog-probe.ts",
  "Dialog probe snapshot",
  {
    ownerEnabled,
    foreground: String(foreground),
    windows: foundDialogs,
  },
  "H3",
  "probe",
);

// Close via the tracked active dialog instance
closeActiveSettingsDialog();

for (let i = 0; i < 30; i += 1) {
  pumpOnce(ctx);
  await Bun.sleep(16);
}

const result = await Promise.race([
  dialogPromise,
  Bun.sleep(2000).then(() => "timeout" as const),
]);

agentLog(
  "settings-dialog-probe.ts",
  "Dialog closed",
  { result: result === "timeout" ? "timeout" : result !== null },
  "H2",
  "probe",
);

win.destroy();

if (result === "timeout") {
  throw new Error("Settings dialog did not close within 2s");
}

console.log("settings-dialog-probe ok");
