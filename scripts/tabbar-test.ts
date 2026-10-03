/**
 * Tab strip chrome regression test: samples painted pixels per theme.
 * Guards against strip-background color mismatches (e.g. white strip
 * under high-contrast, where ui.border is #ffffff).
 * Run: bun run test:tabbar
 */
import { join } from "node:path";
import { rm } from "node:fs/promises";

import { dlopen, FFIType } from "bun:ffi";
import User32 from "@bun-win32/user32";

import { SettingsStore } from "../src/app/settings";
import { MainWindow } from "../src/app/window";
import { pumpOnce } from "../src/loop/messageLoop";
import { ExtensionHost } from "../src/extensions/host";
import { hexToColorRef } from "../src/theme/colors";
import { ThemeController } from "../src/theme/controller";
import { ThemeManager } from "../src/theme/manager";
import { WM_CLOSE } from "../src/win32/constants";
import { ffiPtr } from "../src/win32/strings";

process.env.BUNPAD_TEST = "1";

const gdi = dlopen("gdi32.dll", {
  GetPixel: {
    args: [FFIType.u64, FFIType.i32, FFIType.i32],
    returns: FFIType.u32,
  },
});

const CLR_INVALID = 0xffffffff;

for (const themeId of ["high-contrast", "light"]) {
  const settings = new SettingsStore(
    join(process.cwd(), `.tmp-settings-tabbar-${themeId}.json`),
  );
  await settings.load();

  const themeManager = new ThemeManager(
    join(process.cwd(), "themes"),
    join(process.cwd(), ".tmp-themes"),
    settings,
  );
  await themeManager.init();

  const themeController = new ThemeController(themeManager);
  await themeController.selectTheme(themeId);
  const theme = themeController.current();

  const extensionHost = new ExtensionHost(join(process.cwd(), "extensions"));
  await extensionHost.loadAll();

  const win = MainWindow.create({
    title: "BunPad TabBar Test",
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
  User32.UpdateWindow(win.tabHandle);
  pumpOnce(ctx);

  const rect = Buffer.alloc(16);
  if (!User32.GetClientRect(win.tabHandle, ffiPtr(rect))) {
    throw new Error(`[${themeId}] GetClientRect(tab) failed`);
  }
  const stripWidth = rect.readInt32LE(8) - rect.readInt32LE(0);
  if (stripWidth < 300) {
    throw new Error(`[${themeId}] unexpected strip width ${stripWidth}`);
  }

  const hdc = User32.GetDC(win.tabHandle);
  if (!hdc) {
    throw new Error(`[${themeId}] GetDC(tab) failed`);
  }
  try {
    // Empty strip area right of the "+" button — must be menuBar bg.
    const strip = gdi.symbols.GetPixel(
      hdc,
      stripWidth - 10,
      15,
    ) as unknown as number;
    // Inside the active tab padding (left of label text, below accent line).
    const tab = gdi.symbols.GetPixel(hdc, 8, 25) as unknown as number;
    // Accent top line of the active tab.
    const accentLine = gdi.symbols.GetPixel(hdc, 40, 3) as unknown as number;

    const expectedStrip = hexToColorRef(theme.ui.menuBar.background);
    const expectedTab = hexToColorRef(theme.editor.background);
    const expectedAccent = hexToColorRef(theme.ui.accent);

    if (strip === CLR_INVALID || tab === CLR_INVALID) {
      throw new Error(`[${themeId}] GetPixel failed`);
    }
    if (strip !== expectedStrip) {
      throw new Error(
        `[${themeId}] strip 0x${strip.toString(16)} != menuBar.background 0x${expectedStrip.toString(16)}`,
      );
    }
    if (tab !== expectedTab) {
      throw new Error(
        `[${themeId}] tab 0x${tab.toString(16)} != editor.background 0x${expectedTab.toString(16)}`,
      );
    }
    if (accentLine !== expectedAccent) {
      throw new Error(
        `[${themeId}] accent 0x${accentLine.toString(16)} != ui.accent 0x${expectedAccent.toString(16)}`,
      );
    }
    console.log(
      `[${themeId}] strip=0x${strip.toString(16)} tab=0x${tab.toString(16)} accent=0x${accentLine.toString(16)} ok`,
    );
  } finally {
    User32.ReleaseDC(win.tabHandle, hdc);
  }

  User32.PostMessageW(win.handle, WM_CLOSE, 0n, 0n);
  const deadline = Date.now() + 3000;
  while (running && Date.now() < deadline) {
    pumpOnce(ctx);
    await Bun.sleep(16);
  }
  win.destroy();
}

console.log("tabbar-test ok");

await Promise.all(
  ["high-contrast", "light"].map((themeId) =>
    rm(join(process.cwd(), `.tmp-settings-tabbar-${themeId}.json`), {
      force: true,
    }),
  ),
);
