import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { hexToColorRef } from "../theme/colors";
import type { ThemeDefinition } from "../theme/types";
import {
  createFont,
  createSolidBrush,
  deleteGdiObject,
  selectObject,
  setBkModeTransparent,
  setTextColor,
  textOutW,
} from "../win32/gdi32";
import { STATUS_BAR_HEIGHT } from "../win32/layout";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";
import { CS_HREDRAW, CS_VREDRAW } from "../win32/constants";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;
const WM_PAINT = 0x000f;

/** Bottom status strip showing document and cursor info. */
export class StatusBar {
  private readonly classNameBuf = encodeWide(`BunPadStatus_${process.pid}`);
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private hwnd = 0n;
  private leftText = "Ready";
  private rightText = "";
  private theme: ThemeDefinition;
  private brush = 0n;
  private font = 0n;

  constructor(
    private readonly parentHwnd: bigint,
    theme: ThemeDefinition,
  ) {
    this.theme = theme;
    this.wndProc = new JSCallback(
      (hWnd, msg, wParam, lParam) =>
        msg === WM_PAINT
          ? (this.paint(hWnd), 0n)
          : User32.DefWindowProcW(hWnd, msg, wParam, lParam),
      { args: ["u64", "u32", "u64", "i64"], returns: "i64" },
    );

    this.wndClassBuf = packWndClassEx(
      this.wndProc.ptr!,
      this.classNameBuf,
      CS_HREDRAW | CS_VREDRAW,
    );

    User32.RegisterClassExW(ffiPtr(this.wndClassBuf));
    this.resetResources();
  }

  create(): void {
    this.hwnd = User32.CreateWindowExW(
      0,
      ffiPtr(this.classNameBuf),
      NULL_PTR,
      WindowStyles.WS_CHILD | WindowStyles.WS_VISIBLE,
      0,
      0,
      100,
      STATUS_BAR_HEIGHT,
      this.parentHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.hwnd) {
      throw new Error("StatusBar CreateWindowExW failed");
    }
  }

  get handle(): bigint {
    return this.hwnd;
  }

  resize(width: number, y: number): void {
    if (!this.hwnd) {
      return;
    }
    User32.MoveWindow(this.hwnd, 0, y, width, STATUS_BAR_HEIGHT, 1);
  }

  setLeft(text: string): void {
    this.leftText = text;
    User32.InvalidateRect(this.hwnd, null, 1);
  }

  setRight(text: string): void {
    this.rightText = text;
    User32.InvalidateRect(this.hwnd, null, 1);
  }

  setTheme(theme: ThemeDefinition): void {
    this.theme = theme;
    this.resetResources();
    User32.InvalidateRect(this.hwnd, null, 1);
  }

  destroy(): void {
    deleteGdiObject(this.brush);
    deleteGdiObject(this.font);
    this.brush = 0n;
    this.font = 0n;

    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      this.hwnd = 0n;
    }
    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
    this.wndProc.close();
  }

  private resetResources(): void {
    deleteGdiObject(this.brush);
    deleteGdiObject(this.font);
    this.brush = createSolidBrush(
      hexToColorRef(this.theme.ui.statusBar.background),
    );
    this.font = createFont({
      height: -14,
      faceName: "Segoe UI",
    });
  }

  private paint(hWnd: bigint): void {
    const ps = Buffer.alloc(72);
    const hdc = User32.BeginPaint(hWnd, ffiPtr(ps));
    if (!hdc) {
      return;
    }

    const rect = Buffer.alloc(16);
    User32.GetClientRect(hWnd, ffiPtr(rect));
    User32.FillRect(hdc, ffiPtr(rect), this.brush);

    selectObject(hdc, this.font);
    setBkModeTransparent(hdc);
    setTextColor(hdc, hexToColorRef(this.theme.ui.statusBar.foreground));

    const left = encodeWide(this.leftText);
    const right = encodeWide(this.rightText);
    this.retain.push(left, right);

    textOutW(hdc, 12, 4, left, this.leftText.length);

    const clientWidth = rect.readInt32LE(8) - rect.readInt32LE(0);
    const rightWidth = this.rightText.length * 7;
    textOutW(
      hdc,
      Math.max(12, clientWidth - rightWidth - 12),
      4,
      right,
      this.rightText.length,
    );

    User32.EndPaint(hWnd, ffiPtr(ps));
  }
}
