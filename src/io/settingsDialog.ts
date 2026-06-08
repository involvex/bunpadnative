import User32, { WindowStyles } from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { beginModalDialog, endModalDialog } from "../ui/modalGuard";
import type { EditorSettings } from "../theme/types";
import {
  CS_HREDRAW,
  CS_VREDRAW,
  WM_CLOSE,
  WM_COMMAND,
  WM_DESTROY,
} from "../win32/constants";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;

const IDOK = 1;
const IDCANCEL = 2;

const BUTTON_CLASS = encodeWide("BUTTON");
const STATIC_CLASS = encodeWide("STATIC");

const WS_CHILD = WindowStyles.WS_CHILD;
const WS_VISIBLE = WindowStyles.WS_VISIBLE;
const WS_TABSTOP = 0x0001_0000;
const BS_AUTOCHECKBOX = 0x0003;
const BS_DEFPUSHBUTTON = 0x0001;
const BS_PUSHBUTTON = 0x0000_0000;
const SS_LEFT = 0x0000_0000;

const DLG_WIDTH = 420;
const DLG_HEIGHT = 306;
const MARGIN = 16;
const ROW = 26;
const BTN_W = 88;
const BTN_H = 26;

const CHECK_IDS = {
  wordCompletion: 101,
  autoCloseBrackets: 102,
  bracketMatching: 103,
  showBreadcrumbs: 104,
  showSymbolBreadcrumbs: 105,
} as const;

let activeDialog: SettingsDialog | null = null;
let openingDialog = false;
let activeDialogHwnd = 0n;

export const getActiveSettingsDialogHwnd = (): bigint => activeDialogHwnd;

/** Close any open preferences dialog (e.g. during app shutdown). */
export const closeActiveSettingsDialog = (): void => {
  activeDialog?.forceClose();
};

export const isSettingsDialogOpen = (): boolean => activeDialog !== null;

/** Modal preferences dialog for editor settings. */
export class SettingsDialog {
  private readonly classNameBuf = encodeWide(`BunPadSettings_${process.pid}`);
  private readonly titleBuf: Buffer;
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;
  private readonly retain: Buffer[] = [];

  private owner = 0n;
  private hwnd = 0n;
  private resolve: ((value: EditorSettings | null) => void) | null = null;
  private finalized = false;
  private closing = false;
  private savedResult: EditorSettings | null = null;
  private checkboxes = new Map<number, bigint>();

  constructor(private readonly initial: EditorSettings) {
    this.titleBuf = encodeWide("Preferences");
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

  show(owner: bigint): Promise<EditorSettings | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.owner = owner;
      activeDialog = this;
      beginModalDialog();

      const atom = User32.RegisterClassExW(ffiPtr(this.wndClassBuf));
      if (!atom) {
        this.releaseActiveSlot();
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
        DLG_HEIGHT,
        owner,
        NULL,
        NULL,
        NULL_PTR,
      );

      if (!this.hwnd) {
        User32.EnableWindow(owner, 1);
        User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
        User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
        this.releaseActiveSlot();
        queueMicrotask(() => {
          this.wndProc.close();
        });
        resolve(null);
        return;
      }

      this.createControls();
      this.centerOnOwner();
      User32.ShowWindow(this.hwnd, 5);
      User32.SetForegroundWindow(this.hwnd);
      activeDialogHwnd = this.hwnd;
    });
  }

  forceClose(): void {
    this.beginClose(null);
  }

  private releaseActiveSlot(): void {
    if (activeDialog === this) {
      activeDialog = null;
    }
    endModalDialog();
  }

  private createControls(): void {
    let y = MARGIN;
    this.addStatic("Editor", y);
    y += 20;

    this.addCheckbox(
      "Word completion",
      CHECK_IDS.wordCompletion,
      this.initial.wordCompletion,
      y,
    );
    y += ROW;
    this.addCheckbox(
      "Auto-close brackets and quotes",
      CHECK_IDS.autoCloseBrackets,
      this.initial.autoCloseBrackets,
      y,
    );
    y += ROW;
    this.addCheckbox(
      "Bracket matching highlight",
      CHECK_IDS.bracketMatching,
      this.initial.bracketMatching,
      y,
    );
    y += ROW;
    this.addCheckbox(
      "Show file path breadcrumbs",
      CHECK_IDS.showBreadcrumbs,
      this.initial.showBreadcrumbs,
      y,
    );
    y += ROW;
    this.addCheckbox(
      "Show symbol breadcrumbs",
      CHECK_IDS.showSymbolBreadcrumbs,
      this.initial.showSymbolBreadcrumbs,
      y,
    );

    const btnY = DLG_HEIGHT - MARGIN - BTN_H - 8;
    const okX = DLG_WIDTH - MARGIN - BTN_W * 2 - 8;
    this.addButton("OK", IDOK, okX, btnY, true);
    this.addButton("Cancel", IDCANCEL, okX + BTN_W + 8, btnY, false);
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

  private addCheckbox(
    caption: string,
    id: number,
    checked: boolean,
    y: number,
  ): void {
    const label = encodeWide(caption);
    this.retain.push(label);
    const hwnd = User32.CreateWindowExW(
      0,
      ffiPtr(BUTTON_CLASS),
      ffiPtr(label),
      WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTOCHECKBOX,
      MARGIN,
      y,
      DLG_WIDTH - MARGIN * 2,
      20,
      this.hwnd,
      BigInt(id),
      NULL,
      NULL_PTR,
    );
    if (checked) {
      User32.SendMessageW(hwnd, 0x00f1, 1n, 0n);
    }
    this.checkboxes.set(id, hwnd);
  }

  private addButton(
    caption: string,
    id: number,
    x: number,
    y: number,
    isDefault: boolean,
  ): void {
    const label = encodeWide(caption);
    this.retain.push(label);
    User32.CreateWindowExW(
      0,
      ffiPtr(BUTTON_CLASS),
      ffiPtr(label),
      WS_CHILD |
        WS_VISIBLE |
        WS_TABSTOP |
        (isDefault ? BS_DEFPUSHBUTTON : BS_PUSHBUTTON),
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

  private isChecked(id: number): boolean {
    const hwnd = this.checkboxes.get(id);
    if (!hwnd) {
      return false;
    }
    return User32.SendMessageW(hwnd, 0x00f0, 0n, 0n) === 1n;
  }

  private readSettings(): EditorSettings {
    return {
      wordCompletion: this.isChecked(CHECK_IDS.wordCompletion),
      completionMinChars: this.initial.completionMinChars,
      autoCloseBrackets: this.isChecked(CHECK_IDS.autoCloseBrackets),
      bracketMatching: this.isChecked(CHECK_IDS.bracketMatching),
      showBreadcrumbs: this.isChecked(CHECK_IDS.showBreadcrumbs),
      showSymbolBreadcrumbs: this.isChecked(CHECK_IDS.showSymbolBreadcrumbs),
    };
  }

  private centerOnOwner(): void {
    const ownerRect = Buffer.alloc(16);
    User32.GetWindowRect(this.owner, ffiPtr(ownerRect));

    const ownerW = ownerRect.readInt32LE(8) - ownerRect.readInt32LE(0);
    const ownerH = ownerRect.readInt32LE(12) - ownerRect.readInt32LE(4);

    const x = ownerRect.readInt32LE(0) + Math.max(0, (ownerW - DLG_WIDTH) / 2);
    const y = ownerRect.readInt32LE(4) + Math.max(0, (ownerH - DLG_HEIGHT) / 2);
    User32.SetWindowPos(
      this.hwnd,
      this.owner,
      x,
      y,
      DLG_WIDTH,
      DLG_HEIGHT,
      0x0040,
    );
  }

  private beginClose(result: EditorSettings | null): void {
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
    activeDialogHwnd = 0n;
    this.releaseActiveSlot();

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
          this.beginClose(this.readSettings());
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

export const showSettingsDialog = async (
  owner: bigint,
  initial: EditorSettings,
): Promise<EditorSettings | null> => {
  if (activeDialog || openingDialog) {
    return null;
  }

  openingDialog = true;
  try {
    const dialog = new SettingsDialog(initial);
    return await dialog.show(owner);
  } finally {
    openingDialog = false;
  }
};
