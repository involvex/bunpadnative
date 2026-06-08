import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { pointerToBigInt } from "../win32/pointers";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";
import { CS_HREDRAW, CS_VREDRAW } from "../win32/constants";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;
const LISTBOX_CLASS = encodeWide("LISTBOX");

const WS_CHILD = WindowStyles.WS_CHILD;
const WS_VISIBLE = WindowStyles.WS_VISIBLE;
const WS_BORDER = 0x0080_0000;
const WS_VSCROLL = 0x0020_0000;

const WM_KEYDOWN = 0x0100;
const VK_UP = 0x26;
const VK_DOWN = 0x28;
const VK_RETURN = 0x0d;
const VK_ESCAPE = 0x1b;
const VK_TAB = 0x09;

const LB_ADDSTRING = 0x0180;
const LB_SETCURSEL = 0x0186;
const LB_GETCURSEL = 0x0188;

/** Floating LISTBOX completion popup anchored near the caret. */
export class CompletionPopup {
  private readonly classNameBuf = encodeWide(`BunPadComplete_${process.pid}`);
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private parentHwnd = 0n;
  private listHwnd = 0n;
  private popupHwnd = 0n;
  private items: string[] = [];
  private visible = false;

  constructor() {
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
  }

  bind(parentHwnd: bigint): void {
    this.parentHwnd = parentHwnd;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  show(items: string[], screenX: number, screenY: number): void {
    this.hide();
    if (items.length === 0) {
      return;
    }

    this.items = items;
    const rowHeight = 18;
    const width = 220;
    const height = Math.min(items.length, 8) * rowHeight + 4;

    this.popupHwnd = User32.CreateWindowExW(
      0x0000_0088,
      ffiPtr(this.classNameBuf),
      NULL_PTR,
      WindowStyles.WS_POPUP | WS_BORDER,
      screenX,
      screenY + 20,
      width,
      height,
      this.parentHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.popupHwnd) {
      return;
    }

    this.listHwnd = User32.CreateWindowExW(
      0,
      ffiPtr(LISTBOX_CLASS),
      NULL_PTR,
      WS_CHILD | WS_VISIBLE | WS_VSCROLL,
      2,
      2,
      width - 4,
      height - 4,
      this.popupHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    for (const item of items) {
      const wide = encodeWide(item);
      this.retain.push(wide);
      User32.SendMessageW(
        this.listHwnd,
        LB_ADDSTRING,
        0n,
        pointerToBigInt(wide),
      );
    }

    User32.SendMessageW(this.listHwnd, LB_SETCURSEL, 0n, 0n);
    User32.ShowWindow(this.popupHwnd, 5);
    User32.SetForegroundWindow(this.popupHwnd);
    this.visible = true;
  }

  hide(): void {
    if (this.popupHwnd) {
      User32.DestroyWindow(this.popupHwnd);
      this.popupHwnd = 0n;
      this.listHwnd = 0n;
    }
    this.visible = false;
    this.items = [];
  }

  destroy(): void {
    this.hide();
    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
    this.wndProc.close();
  }

  selectedItem(): string | null {
    if (!this.listHwnd) {
      return null;
    }
    const index = Number(
      User32.SendMessageW(this.listHwnd, LB_GETCURSEL, 0n, 0n),
    );
    return this.items[index] ?? null;
  }

  handleKeyDown(vk: number): boolean {
    if (!this.visible || !this.listHwnd) {
      return false;
    }

    switch (vk) {
      case VK_UP:
        User32.SendMessageW(this.listHwnd, LB_SETCURSEL, -1n, 0n);
        return true;
      case VK_DOWN:
        User32.SendMessageW(this.listHwnd, LB_SETCURSEL, 1n, 0n);
        return true;
      case VK_RETURN:
      case VK_TAB:
        return true;
      case VK_ESCAPE:
        this.hide();
        return true;
      default:
        return false;
    }
  }

  private handleMessage(
    hWnd: bigint,
    msg: number,
    wParam: bigint,
    lParam: bigint,
  ): bigint {
    if (msg === WM_KEYDOWN) {
      const vk = Number(wParam & 0xffffn);
      if (this.handleKeyDown(vk)) {
        return 0n;
      }
    }
    return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
  }
}
