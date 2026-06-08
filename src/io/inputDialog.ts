import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { beginModalDialog, endModalDialog } from "../ui/modalGuard";
import {
  CS_HREDRAW,
  CS_VREDRAW,
  WM_CLOSE,
  WM_COMMAND,
  WM_DESTROY,
} from "../win32/constants";
import { encodeWide, ffiPtr } from "../win32/strings";
import { pointerToBigInt } from "../win32/pointers";
import { packWndClassEx } from "../win32/wndclass";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;

const IDOK = 1;
const IDCANCEL = 2;

const EDIT_CLASS = encodeWide("EDIT");
const BUTTON_CLASS = encodeWide("BUTTON");
const STATIC_CLASS = encodeWide("STATIC");

const WS_CHILD = WindowStyles.WS_CHILD;
const WS_VISIBLE = WindowStyles.WS_VISIBLE;
const WS_TABSTOP = 0x0001_0000;
const ES_AUTOHSCROLL = 0x0080;
const BS_PUSHBUTTON = 0x0000_0000;
const SS_LEFT = 0x0000_0000;

const DLG_WIDTH = 420;
const DLG_HEIGHT = 130;
const MARGIN = 12;
const ROW = 28;
const BTN_W = 88;
const BTN_H = 26;

type DialogResult = {
  primary: string;
  secondary: string;
};

/** Modal Win32 input dialog with one or two text fields. */
export class InputDialog {
  private readonly classNameBuf = encodeWide(`BunPadInput_${process.pid}`);
  private readonly titleBuf: Buffer;
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private owner = 0n;
  private hwnd = 0n;
  private primaryEdit = 0n;
  private secondaryEdit = 0n;
  private resolve: ((value: DialogResult | null) => void) | null = null;
  private finalized = false;
  private closing = false;
  private savedResult: DialogResult | null = null;

  constructor(
    private readonly title: string,
    private readonly primaryLabel: string,
    private readonly secondaryLabel: string | null,
    private readonly defaults: DialogResult,
  ) {
    this.titleBuf = encodeWide(title);
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
  }

  show(owner: bigint): Promise<DialogResult | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.owner = owner;
      beginModalDialog();

      const atom = User32.RegisterClassExW(ffiPtr(this.wndClassBuf));
      if (!atom) {
        endModalDialog();
        resolve(null);
        return;
      }

      User32.EnableWindow(owner, 0);

      this.hwnd = User32.CreateWindowExW(
        0,
        ffiPtr(this.classNameBuf),
        ffiPtr(this.titleBuf),
        WindowStyles.WS_CAPTION |
          WindowStyles.WS_SYSMENU |
          WindowStyles.WS_POPUP,
        0,
        0,
        DLG_WIDTH,
        this.secondaryLabel ? DLG_HEIGHT + ROW : DLG_HEIGHT,
        owner,
        NULL,
        NULL,
        NULL_PTR,
      );

      if (!this.hwnd) {
        User32.EnableWindow(owner, 1);
        User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
        endModalDialog();
        resolve(null);
        return;
      }

      this.createControls();
      this.centerOnOwner();
      User32.ShowWindow(this.hwnd, 5);
      User32.SetForegroundWindow(this.hwnd);
      User32.SetFocus(this.primaryEdit);
    });
  }

  private createControls(): void {
    let y = MARGIN;
    this.addStatic(this.primaryLabel, y);
    y += 18;
    this.primaryEdit = this.addEdit(this.defaults.primary, y);
    y += ROW + 4;

    if (this.secondaryLabel) {
      this.addStatic(this.secondaryLabel, y);
      y += 18;
      this.secondaryEdit = this.addEdit(this.defaults.secondary, y);
      y += ROW + 4;
    }

    const btnY = y + 4;
    const okX = DLG_WIDTH - MARGIN - BTN_W * 2 - 8;
    this.addButton("OK", IDOK, okX, btnY);
    this.addButton("Cancel", IDCANCEL, okX + BTN_W + 8, btnY);
  }

  private addStatic(text: string, y: number): void {
    const label = encodeWide(text);
    this.retain.push(label);
    User32.CreateWindowExW(
      0,
      ffiPtr(STATIC_CLASS),
      ffiPtr(label),
      WS_CHILD | WS_VISIBLE | SS_LEFT,
      MARGIN,
      y,
      DLG_WIDTH - MARGIN * 2,
      16,
      this.hwnd,
      NULL,
      NULL,
      NULL_PTR,
    );
  }

  private addEdit(defaultValue: string, y: number): bigint {
    const value = encodeWide(defaultValue);
    this.retain.push(value);
    const edit = User32.CreateWindowExW(
      0,
      ffiPtr(EDIT_CLASS),
      ffiPtr(value),
      WS_CHILD | WS_VISIBLE | WS_TABSTOP | ES_AUTOHSCROLL,
      MARGIN,
      y,
      DLG_WIDTH - MARGIN * 2,
      22,
      this.hwnd,
      NULL,
      NULL,
      NULL_PTR,
    );
    return edit;
  }

  private addButton(caption: string, id: number, x: number, y: number): void {
    const label = encodeWide(caption);
    this.retain.push(label);
    User32.CreateWindowExW(
      0,
      ffiPtr(BUTTON_CLASS),
      ffiPtr(label),
      WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON,
      x,
      y,
      BTN_W,
      BTN_H,
      this.hwnd,
      BigInt(id),
      NULL,
      NULL_PTR,
    );
  }

  private centerOnOwner(): void {
    const ownerRect = Buffer.alloc(16);
    const dlgRect = Buffer.alloc(16);
    User32.GetWindowRect(this.owner, ffiPtr(ownerRect));
    User32.GetWindowRect(this.hwnd, ffiPtr(dlgRect));

    const ownerW = ownerRect.readInt32LE(8) - ownerRect.readInt32LE(0);
    const ownerH = ownerRect.readInt32LE(12) - ownerRect.readInt32LE(4);
    const dlgW = dlgRect.readInt32LE(8) - dlgRect.readInt32LE(0);
    const dlgH = dlgRect.readInt32LE(12) - dlgRect.readInt32LE(4);

    const x = ownerRect.readInt32LE(0) + Math.max(0, (ownerW - dlgW) / 2);
    const y = ownerRect.readInt32LE(4) + Math.max(0, (ownerH - dlgH) / 2);
    User32.SetWindowPos(this.hwnd, 0n, x, y, 0, 0, 0x0040);
  }

  private readEditText(editHwnd: bigint): string {
    const length = Number(User32.SendMessageW(editHwnd, 0x000e, 0n, 0n));
    if (length <= 0) {
      return "";
    }

    const buf = Buffer.alloc((length + 1) * 2);
    User32.SendMessageW(
      editHwnd,
      0x000d,
      BigInt(length + 1),
      pointerToBigInt(buf),
    );
    return buf.toString("utf16le").replace(/\0.*$/, "");
  }

  private resultFromInputs(): DialogResult {
    return {
      primary: this.readEditText(this.primaryEdit),
      secondary: this.secondaryEdit
        ? this.readEditText(this.secondaryEdit)
        : "",
    };
  }

  private beginClose(result: DialogResult | null): void {
    if (this.closing) {
      return;
    }
    this.closing = true;
    this.savedResult = result;

    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      return;
    }

    this.finalizeClose();
  }

  private finalizeClose(): void {
    if (this.finalized) {
      return;
    }
    this.finalized = true;

    this.hwnd = 0n;
    endModalDialog();

    if (this.owner) {
      User32.EnableWindow(this.owner, 1);
      User32.SetForegroundWindow(this.owner);
    }

    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);

    const resolve = this.resolve;
    const result = this.savedResult;
    this.resolve = null;

    if (resolve) {
      resolve(result);
    }

    queueMicrotask(() => {
      this.wndProc.close();
    });
  }

  private handleMessage(
    hWnd: bigint,
    msg: number,
    wParam: bigint,
    lParam: bigint,
  ): bigint {
    switch (msg) {
      case WM_COMMAND: {
        const commandId = Number(wParam & 0xffffn);
        if (commandId === IDOK) {
          this.beginClose(this.resultFromInputs());
          return 0n;
        }
        if (commandId === IDCANCEL) {
          this.beginClose(null);
          return 0n;
        }
        return 0n;
      }

      case WM_CLOSE:
        this.beginClose(null);
        return 0n;

      case WM_DESTROY:
        this.hwnd = 0n;
        this.finalizeClose();
        return 0n;

      default:
        return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
    }
  }
}

export const showInputDialog = async (
  owner: bigint,
  title: string,
  label: string,
  defaultValue = "",
): Promise<string | null> => {
  const dialog = new InputDialog(title, label, null, {
    primary: defaultValue,
    secondary: "",
  });
  const result = await dialog.show(owner);
  return result?.primary ?? null;
};

export const showReplaceDialog = async (
  owner: bigint,
  findDefault: string,
  replaceDefault: string,
): Promise<{ find: string; replace: string } | null> => {
  const dialog = new InputDialog("Replace", "Find what:", "Replace with:", {
    primary: findDefault,
    secondary: replaceDefault,
  });
  const result = await dialog.show(owner);
  if (!result) {
    return null;
  }
  return { find: result.primary, replace: result.secondary };
};
