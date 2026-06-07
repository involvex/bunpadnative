/**
 * Smoke test: editor I/O, programmatic close.
 * Run: bun run scripts/smoke-test.ts
 */
import User32 from "@bun-win32/user32";

import { MainWindow } from "../src/app/window";
import { pumpOnce } from "../src/loop/messageLoop";
import { WM_CLOSE } from "../src/win32/constants";

const win = MainWindow.create({ title: "BunPad Smoke Test", width: 640, height: 480 });
const ctx = win.pumpContext;

let running = true;
win.onClose = () => {
  running = false;
};

win.editor?.setText("BunPad Phase 3 smoke test");
pumpOnce(ctx);

const readBack = win.editor?.getText() ?? "";
if (!readBack.includes("BunPad Phase 3")) {
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
