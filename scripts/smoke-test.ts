/**
 * Headless-ish smoke test: create window, inject text via WM_SETTEXT, close.
 * Run: bun run scripts/smoke-test.ts
 */
import User32, { MessageFilter } from "@bun-win32/user32";

import { MainWindow } from "../src/app/window";
import { pumpOnce } from "../src/loop/messageLoop";
import { encodeWide } from "../src/win32/strings";

const win = MainWindow.create({ title: "BunPad Smoke Test", width: 640, height: 480 });

let running = true;
win.onClose = () => {
  running = false;
};

const sample = encodeWide("BunPad Phase 1 smoke test");
User32.SendMessageW(
  win.editorHandle,
  MessageFilter.WM_SETTEXT,
  0n,
  BigInt(sample.ptr!),
);

pumpOnce();

const textLen = Number(
  User32.SendMessageW(
    win.editorHandle,
    MessageFilter.WM_GETTEXTLENGTH,
    0n,
    0n,
  ),
);

if (textLen <= 0) {
  throw new Error("WM_GETTEXTLENGTH returned 0 after WM_SETTEXT");
}

const textBuf = Buffer.alloc((textLen + 1) * 2);
User32.SendMessageW(
  win.editorHandle,
  MessageFilter.WM_GETTEXT,
  BigInt(textLen + 1),
  BigInt(textBuf.ptr!),
);

const readBack = new TextDecoder("utf-16le")
  .decode(textBuf)
  .replace(/\0.*$/, "");

if (!readBack.includes("BunPad Phase 1")) {
  throw new Error(`Unexpected editor text: ${readBack}`);
}

User32.PostMessageW(win.handle, 0x0010, 0n, 0n);

const deadline = Date.now() + 3000;
while (running && Date.now() < deadline) {
  pumpOnce();
  await Bun.sleep(16);
}

if (running) {
  win.destroy();
  throw new Error("Window did not close within 3s");
}

win.destroy();
console.log("smoke-test ok");
