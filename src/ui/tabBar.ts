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
import { TAB_BAR_HEIGHT } from "../win32/layout";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";
import { CS_HREDRAW, CS_VREDRAW } from "../win32/constants";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;
const WM_PAINT = 0x000f;
const WM_LBUTTONDOWN = 0x0201;
const WM_MOUSEMOVE = 0x0200;
const WM_MOUSELEAVE = 0x02a3;
const TME_LEAVE = 0x00000002;

const TAB_PAD_X = 12;
const TAB_GAP = 4;
const TAB_MAX_WIDTH = 180;
const CLOSE_WIDTH = 20;
const NEW_BUTTON_WIDTH = 32;

export type TabBarItem = {
  label: string;
  dirty: boolean;
};

type TabHit =
  | { kind: "tab"; index: number }
  | { kind: "close"; index: number }
  | { kind: "new" };

/** Custom-drawn tab strip matching chrome_full_ui theming. */
export class TabBar {
  private readonly classNameBuf = encodeWide(`BunPadTabs_${process.pid}`);
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private hwnd = 0n;
  private items: TabBarItem[] = [{ label: "Untitled", dirty: false }];
  private active = 0;
  private hover: TabHit | null = null;
  private trackingMouse = false;
  private theme: ThemeDefinition;
  private brushes = { bg: 0n, active: 0n, hover: 0n, accent: 0n };
  private font = 0n;
  private hits: { hit: TabHit; x: number; width: number }[] = [];
  private onSelectHandler: ((index: number) => void) | null = null;
  private onCloseHandler: ((index: number) => void) | null = null;
  private onNewHandler: (() => void) | null = null;

  constructor(
    private readonly parentHwnd: bigint,
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
      TAB_BAR_HEIGHT,
      this.parentHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.hwnd) {
      throw new Error("TabBar CreateWindowExW failed");
    }
  }

  get handle(): bigint {
    return this.hwnd;
  }

  onSelect(handler: (index: number) => void): void {
    this.onSelectHandler = handler;
  }

  onClose(handler: (index: number) => void): void {
    this.onCloseHandler = handler;
  }

  onNew(handler: () => void): void {
    this.onNewHandler = handler;
  }

  refresh(items: TabBarItem[], active: number): void {
    this.items =
      items.length > 0 ? items : [{ label: "Untitled", dirty: false }];
    this.active = Math.min(Math.max(0, active), this.items.length - 1);
    if (this.hwnd) {
      User32.InvalidateRect(this.hwnd, null, 1);
    }
  }

  resize(width: number, y: number): void {
    if (!this.hwnd) {
      return;
    }
    User32.MoveWindow(this.hwnd, 0, y, width, TAB_BAR_HEIGHT, 1);
  }

  setTheme(theme: ThemeDefinition): void {
    this.theme = theme;
    this.resetResources();
    if (this.hwnd) {
      User32.InvalidateRect(this.hwnd, null, 1);
    }
  }

  destroy(): void {
    deleteGdiObject(this.brushes.bg);
    deleteGdiObject(this.brushes.active);
    deleteGdiObject(this.brushes.hover);
    deleteGdiObject(this.brushes.accent);
    deleteGdiObject(this.font);
    this.brushes = { bg: 0n, active: 0n, hover: 0n, accent: 0n };
    this.font = 0n;

    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      this.hwnd = 0n;
    }
    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
    this.wndProc.close();
  }

  private resetResources(): void {
    deleteGdiObject(this.brushes.bg);
    deleteGdiObject(this.brushes.active);
    deleteGdiObject(this.brushes.hover);
    deleteGdiObject(this.brushes.accent);
    deleteGdiObject(this.font);
    // Strip blends with the menu bar above it; ui.border is a 1px-divider
    // color (white in high-contrast) and must not fill a 30px strip.
    this.brushes = {
      bg: createSolidBrush(hexToColorRef(this.theme.ui.menuBar.background)),
      active: createSolidBrush(hexToColorRef(this.theme.editor.background)),
      hover: createSolidBrush(hexToColorRef(this.theme.ui.menuBar.hover)),
      accent: createSolidBrush(hexToColorRef(this.theme.ui.accent)),
    };
    this.font = createFont({ height: -13, faceName: "Segoe UI" });
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
      case WM_MOUSELEAVE:
        this.trackingMouse = false;
        this.hover = null;
        User32.InvalidateRect(hWnd, null, 1);
        return 0n;
      case WM_LBUTTONDOWN: {
        const hit = this.hitTest(Number(lParam & 0xffffn));
        if (!hit) {
          return 0n;
        }
        if (hit.kind === "tab") {
          this.onSelectHandler?.(hit.index);
        } else if (hit.kind === "close") {
          this.onCloseHandler?.(hit.index);
        } else {
          this.onNewHandler?.();
        }
        return 0n;
      }
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

  private updateHover(x: number): void {
    const next = this.hitTest(x);
    const changed =
      (next?.kind ?? null) !== (this.hover?.kind ?? null) ||
      (next && this.hover && "index" in next && "index" in this.hover
        ? next.index !== this.hover.index
        : next !== this.hover);
    if (changed) {
      this.hover = next;
      User32.InvalidateRect(this.hwnd, null, 1);
    }
  }

  private tabWidth(hdc: bigint, label: string): number {
    const textWidth = measureTextWidth(hdc, label);
    return Math.min(TAB_MAX_WIDTH, textWidth + TAB_PAD_X * 2 + CLOSE_WIDTH + 8);
  }

  private hitTest(x: number): TabHit | null {
    for (const { hit, x: hx, width } of this.hits) {
      if (x >= hx && x < hx + width) {
        return hit;
      }
    }
    return null;
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
    this.hits = [];

    let x = TAB_GAP;
    const accent = hexToColorRef(this.theme.ui.accent);
    const fg = hexToColorRef(this.theme.ui.foreground);
    const inactiveFg = hexToColorRef(this.theme.ui.menuBar.foreground);

    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index]!;
      const width = this.tabWidth(hdc, item.label + (item.dirty ? " •" : ""));
      const isActive = index === this.active;
      const isHover =
        this.hover?.kind === "tab" &&
        "index" in this.hover &&
        this.hover.index === index;

      const tabRect = Buffer.alloc(16);
      tabRect.writeInt32LE(x, 0);
      tabRect.writeInt32LE(2, 4);
      tabRect.writeInt32LE(x + width, 8);
      tabRect.writeInt32LE(TAB_BAR_HEIGHT, 12);
      User32.FillRect(
        hdc,
        ffiPtr(tabRect),
        isActive
          ? this.brushes.active
          : isHover
            ? this.brushes.hover
            : this.brushes.bg,
      );

      if (isActive) {
        setTextColor(hdc, fg);
        // Accent top line marks the active tab when editor and strip
        // backgrounds match (e.g. dark themes).
        const topLine = Buffer.alloc(16);
        topLine.writeInt32LE(x, 0);
        topLine.writeInt32LE(2, 4);
        topLine.writeInt32LE(x + width, 8);
        topLine.writeInt32LE(4, 12);
        User32.FillRect(hdc, ffiPtr(topLine), this.brushes.accent);
      } else {
        setTextColor(hdc, inactiveFg);
      }

      const label = item.dirty ? `${item.label} •` : item.label;
      const wide = encodeWide(label);
      this.retain.push(wide);
      textOutW(hdc, x + TAB_PAD_X, 7, wide, label.length);

      // Close affordance.
      const closeX = x + width - CLOSE_WIDTH;
      const closeHover =
        this.hover?.kind === "close" &&
        "index" in this.hover &&
        this.hover.index === index;
      if (isActive || closeHover || item.dirty) {
        setTextColor(hdc, closeHover ? accent : isActive ? fg : inactiveFg);
        const cross = encodeWide("×");
        this.retain.push(cross);
        textOutW(hdc, closeX + 5, 7, cross, 1);
      }

      this.hits.push({
        hit: { kind: "tab", index },
        x,
        width: width - CLOSE_WIDTH,
      });
      this.hits.push({
        hit: { kind: "close", index },
        x: x + width - CLOSE_WIDTH,
        width: CLOSE_WIDTH,
      });

      x += width + TAB_GAP;
    }

    // New-tab button.
    const newRect = Buffer.alloc(16);
    newRect.writeInt32LE(x, 0);
    newRect.writeInt32LE(2, 4);
    newRect.writeInt32LE(x + NEW_BUTTON_WIDTH, 8);
    newRect.writeInt32LE(TAB_BAR_HEIGHT, 12);
    const newHover = this.hover?.kind === "new";
    User32.FillRect(
      hdc,
      ffiPtr(newRect),
      newHover ? this.brushes.hover : this.brushes.bg,
    );
    setTextColor(hdc, fg);
    const plus = encodeWide("+");
    this.retain.push(plus);
    textOutW(hdc, x + 11, 6, plus, 1);
    this.hits.push({ hit: { kind: "new" }, x, width: NEW_BUTTON_WIDTH });

    if (previousFont) {
      selectObject(hdc, previousFont);
    }
    User32.EndPaint(hWnd, ffiPtr(ps));
  }
}
