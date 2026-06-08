import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { hexToColorRef } from "../theme/colors";
import type { ThemeDefinition } from "../theme/types";
import {
  createFont,
  createSolidBrush,
  deleteGdiObject,
  measureTextWidth,
  selectObject,
  setBkModeTransparent,
  setTextColor,
  textOutW,
} from "../win32/gdi32";
import { WM_APP_DEFER_COMMAND } from "../win32/constants";
import { agentLog } from "../debug/agentLog";
import {
  MENU_BAR_HEIGHT,
  TPM_LEFTALIGN,
  TPM_RETURNCMD,
  TPM_TOPALIGN,
  TPM_VERTICAL,
  WM_OPENMENU,
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
const WM_NULL = 0x0000;
const TME_LEAVE = 0x00000002;
const MENU_PAD_X = 12;
const MENU_ITEM_PAD = 16;

export type MenuBarEntry = {
  label: string;
  menu: bigint;
};

/** Custom GDI-painted menu strip with native popup submenus. */
export class MenuBar {
  private readonly classNameBuf = encodeWide(`BunPadMenuBar_${process.pid}`);
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private hwnd = 0n;
  private hoverIndex = -1;
  private openIndex = -1;
  private trackingMouse = false;
  private theme: ThemeDefinition;
  private brushes = { bg: 0n, hover: 0n, active: 0n };
  private font = 0n;
  private itemWidths: number[] = [];

  constructor(
    private readonly parentHwnd: bigint,
    private readonly entries: MenuBarEntry[],
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

  /** Programmatically open a top-level menu (for tests). */
  openMenuAt(index: number): number {
    return this.openMenu(index);
  }

  resize(width: number): void {
    if (!this.hwnd) {
      return;
    }
    User32.MoveWindow(this.hwnd, 0, 0, width, MENU_BAR_HEIGHT, 1);
  }

  setTheme(theme: ThemeDefinition): void {
    this.theme = theme;
    this.resetResources();
    User32.InvalidateRect(this.hwnd, null, 1);
  }

  destroy(): void {
    this.clearResources();
    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      this.hwnd = 0n;
    }
    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
    this.wndProc.close();
  }

  private resetResources(): void {
    this.clearResources();
    const menuBar = this.theme.ui.menuBar;
    this.brushes = {
      bg: createSolidBrush(hexToColorRef(menuBar.background)),
      hover: createSolidBrush(hexToColorRef(menuBar.hover)),
      active: createSolidBrush(hexToColorRef(menuBar.active)),
    };
    this.font = createFont({
      height: -14,
      faceName: "Segoe UI",
      weight: 400,
    });
    this.itemWidths = this.entries.map((entry) =>
      this.estimateItemWidth(entry.label),
    );
  }

  private clearResources(): void {
    deleteGdiObject(this.brushes.bg);
    deleteGdiObject(this.brushes.hover);
    deleteGdiObject(this.brushes.active);
    deleteGdiObject(this.font);
    this.brushes = { bg: 0n, hover: 0n, active: 0n };
    this.font = 0n;
  }

  private estimateItemWidth(label: string): number {
    if (!this.font) {
      return label.length * 8 + MENU_ITEM_PAD;
    }

    const hdc = User32.GetDC(this.hwnd || this.parentHwnd);
    if (!hdc) {
      return label.length * 8 + MENU_ITEM_PAD;
    }

    const previous = selectObject(hdc, this.font);
    const width = measureTextWidth(hdc, label) + MENU_ITEM_PAD;
    selectObject(hdc, previous);
    User32.ReleaseDC(this.hwnd || this.parentHwnd, hdc);
    return width;
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
        this.ensureMouseTracking(hWnd);
        this.updateHover(Number(lParam & 0xffffn));
        return 0n;

      case WM_LBUTTONDOWN: {
        const index = this.hitTest(Number(lParam & 0xffffn));
        if (index >= 0) {
          User32.PostMessageW(hWnd, WM_OPENMENU, BigInt(index), 0n);
        }
        return 0n;
      }

      case WM_OPENMENU:
        this.openMenu(Number(wParam));
        return 0n;

      case WM_MOUSELEAVE:
        this.trackingMouse = false;
        this.hoverIndex = -1;
        User32.InvalidateRect(hWnd, null, 1);
        return 0n;

      default:
        return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
    }
  }

  private ensureMouseTracking(hWnd: bigint): void {
    if (this.trackingMouse) {
      return;
    }

    const tme = Buffer.alloc(24);
    tme.writeUInt32LE(24, 0);
    tme.writeUInt32LE(TME_LEAVE, 4);
    tme.writeBigUInt64LE(hWnd, 8);
    tme.writeUInt32LE(0, 16);

    if (User32.TrackMouseEvent(ffiPtr(tme))) {
      this.trackingMouse = true;
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

    const previousFont = this.font ? selectObject(hdc, this.font) : 0n;
    setBkModeTransparent(hdc);
    setTextColor(hdc, hexToColorRef(this.theme.ui.menuBar.foreground));

    let x = MENU_PAD_X;
    const y = 7;
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index]!;
      const width =
        this.itemWidths[index] ?? this.estimateItemWidth(entry.label);
      const label = encodeWide(entry.label);
      this.retain.push(label);

      const itemRect = Buffer.alloc(16);
      itemRect.writeInt32LE(x, 0);
      itemRect.writeInt32LE(0, 4);
      itemRect.writeInt32LE(x + width, 8);
      itemRect.writeInt32LE(MENU_BAR_HEIGHT, 12);

      if (index === this.hoverIndex || index === this.openIndex) {
        const brush =
          index === this.openIndex ? this.brushes.active : this.brushes.hover;
        User32.FillRect(hdc, ffiPtr(itemRect), brush);
      }

      textOutW(hdc, x + MENU_ITEM_PAD / 2, y, label, entry.label.length);
      x += width;
    }

    if (previousFont) {
      selectObject(hdc, previousFont);
    }

    User32.EndPaint(hWnd, ffiPtr(ps));
  }

  private hitTest(x: number): number {
    let cursor = MENU_PAD_X;
    for (let index = 0; index < this.entries.length; index += 1) {
      const width = this.itemWidths[index] ?? 0;
      if (x >= cursor && x < cursor + width) {
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

  private openMenu(index: number): number {
    const entry = this.entries[index];
    if (!entry?.menu) {
      return 0;
    }

    this.openIndex = index;
    this.hoverIndex = index;
    User32.InvalidateRect(this.hwnd, null, 1);

    const point = Buffer.alloc(8);
    point.writeInt32LE(0, 0);
    point.writeInt32LE(MENU_BAR_HEIGHT, 4);
    User32.ClientToScreen(this.hwnd, ffiPtr(point));

    User32.SetForegroundWindow(this.parentHwnd);

    const cmd = User32.TrackPopupMenu(
      entry.menu,
      TPM_RETURNCMD | TPM_LEFTALIGN | TPM_TOPALIGN | TPM_VERTICAL,
      point.readInt32LE(0),
      point.readInt32LE(4),
      0,
      this.parentHwnd,
      null,
    );

    User32.PostMessageW(this.parentHwnd, WM_NULL, 0n, 0n);

    this.openIndex = -1;
    User32.InvalidateRect(this.hwnd, null, 1);
    User32.SetForegroundWindow(this.parentHwnd);

    if (cmd) {
      agentLog(
        "menuBar.ts:openMenu",
        "TrackPopupMenu returned command; deferring dispatch",
        { index, cmd },
        "H1",
      );
      User32.PostMessageW(
        this.parentHwnd,
        WM_APP_DEFER_COMMAND,
        BigInt(cmd),
        0n,
      );
    } else {
      agentLog(
        "menuBar.ts:openMenu",
        "TrackPopupMenu returned zero",
        { index },
        "H1",
      );
    }

    return cmd;
  }
}
