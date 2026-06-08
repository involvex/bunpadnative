import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { pathForSegment, pathSegments } from "../editor/breadcrumbs";
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
import { BREADCRUMB_HEIGHT } from "../win32/layout";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";
import { CS_HREDRAW, CS_VREDRAW } from "../win32/constants";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;
const WM_PAINT = 0x000f;
const WM_LBUTTONDOWN = 0x0201;

const SEPARATOR = " › ";

type SegmentHit = {
  index: number;
  x: number;
  width: number;
};

/** File-path breadcrumb strip above the editor. */
export class BreadcrumbBar {
  private readonly classNameBuf = encodeWide(`BunPadCrumb_${process.pid}`);
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private hwnd = 0n;
  private filePath: string | null = null;
  private segments: string[] = ["Untitled"];
  private hits: SegmentHit[] = [];
  private visible = true;
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
      BREADCRUMB_HEIGHT,
      this.parentHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.hwnd) {
      throw new Error("BreadcrumbBar CreateWindowExW failed");
    }
  }

  get handle(): bigint {
    return this.hwnd;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!this.hwnd) {
      return;
    }
    User32.ShowWindow(this.hwnd, visible ? 5 : 0);
  }

  isVisible(): boolean {
    return this.visible;
  }

  refresh(filePath: string | null): void {
    this.filePath = filePath;
    this.segments = pathSegments(filePath);
    User32.InvalidateRect(this.hwnd, null, 1);
  }

  resize(width: number, y: number): void {
    if (!this.hwnd) {
      return;
    }
    User32.MoveWindow(this.hwnd, 0, y, width, BREADCRUMB_HEIGHT, 1);
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
    this.brush = createSolidBrush(hexToColorRef(this.theme.ui.border));
    this.font = createFont({
      height: -13,
      faceName: "Segoe UI",
    });
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
      case WM_LBUTTONDOWN:
        this.onClick(Number(lParam & 0xffffn));
        return 0n;
      default:
        return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
    }
  }

  private onClick(x: number): void {
    for (const hit of this.hits) {
      if (x >= hit.x && x < hit.x + hit.width) {
        const target = pathForSegment(this.filePath, hit.index);
        if (target) {
          Bun.spawn(["explorer.exe", "/select,", target]);
        }
        return;
      }
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
    User32.FillRect(hdc, ffiPtr(rect), this.brush);

    selectObject(hdc, this.font);
    setBkModeTransparent(hdc);
    setTextColor(hdc, hexToColorRef(this.theme.ui.foreground));

    this.hits = [];
    let x = 12;
    const clientWidth = rect.readInt32LE(8) - rect.readInt32LE(0);

    for (let index = 0; index < this.segments.length; index += 1) {
      if (index > 0) {
        const sep = encodeWide(SEPARATOR);
        this.retain.push(sep);
        textOutW(hdc, x, 4, sep, SEPARATOR.length);
        x += measureTextWidth(hdc, SEPARATOR);
      }

      const label = this.segments[index]!;
      const wide = encodeWide(label);
      this.retain.push(wide);
      const width = measureTextWidth(hdc, label);
      if (x + width > clientWidth - 12) {
        break;
      }

      this.hits.push({ index, x, width });
      textOutW(hdc, x, 4, wide, label.length);
      x += width + 4;
    }

    User32.EndPaint(hWnd, ffiPtr(ps));
  }
}
