import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { hexToColorRef } from "../theme/colors";
import type { ThemeDefinition } from "../theme/types";
import {
  createSolidBrush,
  deleteGdiObject,
  setBkModeTransparent,
  setTextColor,
  textOutW,
} from "../win32/gdi32";
import {
  MENU_BAR_HEIGHT,
  TPM_LEFTALIGN,
  TPM_RETURNCMD,
  TPM_TOPALIGN,
} from "../win32/layout";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";
import { CS_HREDRAW, CS_VREDRAW } from "../win32/constants";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;
const WM_PAINT = 0x000f;
const WM_MOUSEMOVE = 0x0200;
const WM_LBUTTONDOWN = 0x0201;
const WM_MOUSELEAVE = 0x02a3;

export type MenuBarEntry = {
  label: string;
  menu: bigint;
};

/** Custom GDI-painted menu strip with native popup submenus. */
export class MenuBar {
  private readonly classNameBuf = encodeWide(
    `BunPadMenuBar_${process.pid}`,
  );
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private hwnd = 0n;
  private hoverIndex = -1;
  private theme: ThemeDefinition;
  private brushes = { bg: 0n, hover: 0n, active: 0n };

  constructor(
    private readonly parentHwnd: bigint,
    private readonly entries: MenuBarEntry[],
    private readonly onCommand: (commandId: number) => void,
    theme: ThemeDefinition,
  ) {
    this.theme = theme;
    this.wndProc = new JSCallback(
      (hWnd, msg, wParam, lParam) =>
        this.handleMessage(hWnd, msg, wParam, lParam),
      { args: ["u64", "u32", "u64", "i64"], returns: "i64" },
    );

    this.wndClassBuf = packWndClassEx(
      this.wndProc.ptr!,
      this.classNameBuf,
      CS_HREDRAW | CS_VREDRAW,
    );

    User32.RegisterClassExW(ffiPtr(this.wndClassBuf));
    this.resetBrushes();
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
      MENU_BAR_HEIGHT,
      this.parentHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.hwnd) {
      throw new Error("MenuBar CreateWindowExW failed");
    }
  }

  get handle(): bigint {
    return this.hwnd;
  }

  resize(width: number): void {
    if (!this.hwnd) {
      return;
    }
    User32.MoveWindow(this.hwnd, 0, 0, width, MENU_BAR_HEIGHT, 1);
  }

  setTheme(theme: ThemeDefinition): void {
    this.theme = theme;
    this.resetBrushes();
    User32.InvalidateRect(this.hwnd, null, 1);
  }

  destroy(): void {
    this.clearBrushes();
    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      this.hwnd = 0n;
    }
    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
    this.wndProc.close();
  }

  private resetBrushes(): void {
    this.clearBrushes();
    const menuBar = this.theme.ui.menuBar;
    this.brushes = {
      bg: createSolidBrush(hexToColorRef(menuBar.background)),
      hover: createSolidBrush(hexToColorRef(menuBar.hover)),
      active: createSolidBrush(hexToColorRef(menuBar.active)),
    };
  }

  private clearBrushes(): void {
    deleteGdiObject(this.brushes.bg);
    deleteGdiObject(this.brushes.hover);
    deleteGdiObject(this.brushes.active);
    this.brushes = { bg: 0n, hover: 0n, active: 0n };
  }

  private handleMessage(
    hWnd: bigint,
    msg: number,
    wParam: bigint,
    lParam: bigint,
  ): bigint {
    switch (msg) {
      case WM_PAINT:
        this.paint(hWnd);
        return 0n;

      case WM_MOUSEMOVE:
        this.updateHover(Number(lParam & 0xffffn));
        return 0n;

      case WM_LBUTTONDOWN: {
        const index = this.hitTest(Number(lParam & 0xffffn));
        if (index >= 0) {
          this.openMenu(index);
        }
        return 0n;
      }

      case WM_MOUSELEAVE:
        this.hoverIndex = -1;
        User32.InvalidateRect(hWnd, null, 1);
        return 0n;

      default:
        return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
    }
  }

  private paint(hWnd: bigint): void {
    const ps = Buffer.alloc(72);
    const hdc = User32.BeginPaint(hWnd, ffiPtr(ps));
    if (!hdc) {
      return;
    }

    const rect = Buffer.alloc(16);
    User32.GetClientRect(hWnd, ffiPtr(rect));
    User32.FillRect(hdc, ffiPtr(rect), this.brushes.bg);

    setBkModeTransparent(hdc);
    setTextColor(hdc, hexToColorRef(this.theme.ui.menuBar.foreground));

    let x = 12;
    const y = 8;
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index]!;
      const label = encodeWide(entry.label);
      this.retain.push(label);

      const itemRect = Buffer.alloc(16);
      itemRect.writeInt32LE(x - 8, 0);
      itemRect.writeInt32LE(0, 4);
      itemRect.writeInt32LE(x + entry.label.length * 8 + 8, 8);
      itemRect.writeInt32LE(MENU_BAR_HEIGHT, 12);

      if (index === this.hoverIndex) {
        User32.FillRect(hdc, ffiPtr(itemRect), this.brushes.hover);
      }

      textOutW(hdc, x, y, label, entry.label.length);
      x += entry.label.length * 8 + 20;
    }

    User32.EndPaint(hWnd, ffiPtr(ps));
  }

  private itemWidth(label: string): number {
    return label.length * 8 + 20;
  }

  private hitTest(x: number): number {
    let cursor = 12;
    for (let index = 0; index < this.entries.length; index += 1) {
      const width = this.itemWidth(this.entries[index]!.label);
      if (x >= cursor - 8 && x < cursor - 8 + width) {
        return index;
      }
      cursor += width;
    }
    return -1;
  }

  private updateHover(x: number): void {
    const next = this.hitTest(x);
    if (next !== this.hoverIndex) {
      this.hoverIndex = next;
      User32.InvalidateRect(this.hwnd, null, 1);
    }
  }

  private openMenu(index: number): void {
    const entry = this.entries[index];
    if (!entry) {
      return;
    }

    const point = Buffer.alloc(8);
    point.writeInt32LE(0, 0);
    point.writeInt32LE(MENU_BAR_HEIGHT, 4);
    User32.ClientToScreen(this.hwnd, ffiPtr(point));

    const cmd = User32.TrackPopupMenu(
      entry.menu,
      TPM_RETURNCMD | TPM_LEFTALIGN | TPM_TOPALIGN,
      point.readInt32LE(0),
      point.readInt32LE(4),
      0,
      this.parentHwnd,
      null,
    );

    if (cmd) {
      this.onCommand(cmd);
    }
  }
}
