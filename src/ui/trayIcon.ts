import User32 from "@bun-win32/user32";
import { dlopen, FFIType } from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { getAppRoot } from "../app/paths";
import { WM_TRAYICON } from "../win32/constants";
import { encodeWide, ffiPtr } from "../win32/strings";
import { pointerToBigInt } from "../win32/pointers";

const NIM_ADD = 0x00000000;
const NIM_MODIFY = 0x00000001;
const NIM_DELETE = 0x00000002;
const NIF_MESSAGE = 0x00000001;
const NIF_ICON = 0x00000002;
const NIF_TIP = 0x00000004;
const IDI_APPLICATION = 32512;
const IMAGE_ICON = 1;
const LR_LOADFROMFILE = 0x0010;
const LR_DEFAULTSIZE = 0x0040;
const NOTIFYICONDATAW_SIZE = 984;

const shell32 = dlopen("shell32.dll", {
  Shell_NotifyIconW: {
    args: [FFIType.u32, FFIType.ptr],
    returns: FFIType.i32,
  },
});

const user32Extra = dlopen("user32.dll", {
  LoadIconW: {
    args: [FFIType.ptr, FFIType.ptr],
    returns: FFIType.ptr,
  },
  LoadImageW: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.u32,
      FFIType.i32,
      FFIType.i32,
      FFIType.u32,
    ],
    returns: FFIType.ptr,
  },
});

const WM_LBUTTONDBLCLK = 0x0203;
const WM_RBUTTONUP = 0x0205;

const TRAY_ICON_ID = 1;

const loadTrayIcon = (): bigint => {
  const iconPath = join(getAppRoot(), "assets", "bunpad.ico");
  if (existsSync(iconPath)) {
    const pathBuf = encodeWide(iconPath);
    const fromFile = user32Extra.symbols.LoadImageW(
      0n as unknown as never,
      ffiPtr(pathBuf) as unknown as never,
      IMAGE_ICON,
      0,
      0,
      LR_LOADFROMFILE | LR_DEFAULTSIZE,
    );
    if (fromFile) {
      return pointerToBigInt(fromFile);
    }
  }

  const fallback = user32Extra.symbols.LoadIconW(
    0n as unknown as never,
    BigInt(IDI_APPLICATION) as unknown as never,
  );
  if (!fallback) {
    throw new Error("LoadIconW(IDI_APPLICATION) failed");
  }
  return pointerToBigInt(fallback);
};

/** Pack NOTIFYICONDATAW (x64) for Shell_NotifyIconW. */
const packNotifyIconData = (
  hwnd: bigint,
  hIcon: bigint,
  tip: Buffer,
): Buffer => {
  const nid = Buffer.alloc(NOTIFYICONDATAW_SIZE);
  const view = new DataView(nid.buffer);

  view.setUint32(0, NOTIFYICONDATAW_SIZE, true);
  view.setBigUint64(8, hwnd, true);
  view.setUint32(16, TRAY_ICON_ID, true);
  view.setUint32(20, NIF_MESSAGE | NIF_ICON | NIF_TIP, true);
  view.setUint32(24, WM_TRAYICON, true);
  view.setBigUint64(32, hIcon, true);
  tip.copy(nid, 40, 0, Math.min(tip.length, 256));

  return nid;
};

/** System tray icon with Shell_NotifyIconW lifecycle. */
export class TrayIcon {
  private readonly nidBuf: Buffer;
  private readonly tipBuf: Buffer;
  private readonly hIcon: bigint;
  private added = false;

  constructor(
    private readonly hwnd: bigint,
    tooltip = "BunPad Native",
  ) {
    this.hIcon = loadTrayIcon();
    this.tipBuf = encodeWide(tooltip);
    this.nidBuf = packNotifyIconData(hwnd, this.hIcon, this.tipBuf);
  }

  /** Register the tray icon (NIM_ADD). */
  add(): void {
    if (this.added) {
      return;
    }

    const ok = shell32.symbols.Shell_NotifyIconW(NIM_ADD, ffiPtr(this.nidBuf));
    if (!ok) {
      throw new Error("Shell_NotifyIconW(NIM_ADD) failed");
    }
    this.added = true;
  }

  /** Refresh tooltip after hide/show (NIM_MODIFY). */
  modify(): void {
    if (!this.added) {
      return;
    }
    shell32.symbols.Shell_NotifyIconW(NIM_MODIFY, ffiPtr(this.nidBuf));
  }

  /** Remove tray icon (NIM_DELETE). */
  remove(): void {
    if (!this.added) {
      return;
    }
    shell32.symbols.Shell_NotifyIconW(NIM_DELETE, ffiPtr(this.nidBuf));
    this.added = false;
  }

  /** Handle WM_TRAYICON lParam; returns true when the message was consumed. */
  handleMessage(lParam: bigint): "restore" | "context-menu" | null {
    const event = Number(lParam);
    if (event === WM_LBUTTONDBLCLK) {
      return "restore";
    }
    if (event === WM_RBUTTONUP) {
      return "context-menu";
    }
    return null;
  }

  /** Screen coordinates for a tray context menu (below cursor). */
  contextMenuPoint(): { x: number; y: number } {
    const pointBuf = Buffer.alloc(8);
    User32.GetCursorPos(ffiPtr(pointBuf));
    const view = new DataView(pointBuf.buffer);
    return {
      x: view.getInt32(0, true),
      y: view.getInt32(4, true),
    };
  }
}
