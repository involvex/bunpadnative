import Kernel32 from "@bun-win32/kernel32";
import User32, {
  MessageFilter,
  MessageBoxType,
  ShowWindowCommand,
  WindowStyles,
} from "@bun-win32/user32";
import { JSCallback } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { Document } from "./document";
import { Editor } from "./editor";
import { createAppMenu, MenuCommand, type AppMenu } from "./menu";
import { showOpenDialog, showSaveDialog } from "../io/dialog";
import type { MessagePumpContext } from "../loop/messageLoop";
import {
  CS_HREDRAW,
  CS_VREDRAW,
  CW_USEDEFAULT,
  EDITOR_STYLE_FLAGS,
  EDITOR_WINDOW_STYLES,
  EN_CHANGE,
  FALLBACK_EDIT_CLASS,
  RICHEDIT_CLASS,
  WM_CLOSE,
  WM_COMMAND,
} from "../win32/constants";
import { encodeWide } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;

export type MainWindowOptions = {
  title?: string;
  width?: number;
  height?: number;
};

export class MainWindow {
  /** Strong refs — GC of these buffers/callbacks crashes Win32. */
  private readonly classNameBuf = encodeWide(
    `BunPadMain_${process.pid}`,
  );
  private titleBuf: Buffer;
  private readonly editorClassBuf: Buffer;
  private readonly wndProc: JSCallback;
  private readonly wndClassBuf: Buffer;

  private msfteditModule = 0n;
  private hwnd = 0n;
  private editorHwnd = 0n;
  private destroyed = false;
  private readonly useRichEdit: boolean;
  private readonly menu: AppMenu;

  readonly document = new Document();
  editor: Editor | null = null;

  onClose?: () => void;

  private constructor(options: MainWindowOptions) {
    const title = options.title ?? "BunPad Native";
    this.titleBuf = encodeWide(title);

    this.msfteditModule = Kernel32.LoadLibraryW(
      encodeWide("Msftedit.dll").ptr!,
    );
    this.useRichEdit = this.msfteditModule !== 0n;
    if (!this.useRichEdit) {
      console.warn(
        "LoadLibraryW(Msftedit.dll) failed — falling back to EDIT control",
      );
    }

    const editorClass = this.useRichEdit
      ? RICHEDIT_CLASS
      : FALLBACK_EDIT_CLASS;
    this.editorClassBuf = encodeWide(editorClass);

    this.wndProc = new JSCallback(
      (hWnd, msg, wParam, lParam) =>
        this.handleMessage(hWnd, msg, wParam, lParam),
      { args: ["u64", "u32", "u64", "i64"], returns: "i64" },
    );

    this.wndClassBuf = packWndClassEx(
      this.wndProc.ptr!,
      this.classNameBuf.ptr!,
      CS_HREDRAW | CS_VREDRAW,
    );

    const classAtom = User32.RegisterClassExW(this.wndClassBuf.ptr!);
    if (!classAtom) {
      this.wndProc.close();
      if (this.msfteditModule) {
        Kernel32.FreeLibrary(this.msfteditModule);
      }
      throw new Error("RegisterClassExW failed");
    }

    const width = options.width ?? 1024;
    const height = options.height ?? 768;

    this.hwnd = User32.CreateWindowExW(
      0,
      this.classNameBuf.ptr!,
      this.titleBuf.ptr!,
      WindowStyles.WS_OVERLAPPEDWINDOW | WindowStyles.WS_VISIBLE,
      CW_USEDEFAULT,
      CW_USEDEFAULT,
      width,
      height,
      NULL,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.hwnd) {
      User32.UnregisterClassW(this.classNameBuf.ptr!, NULL);
      this.wndProc.close();
      if (this.msfteditModule) {
        Kernel32.FreeLibrary(this.msfteditModule);
      }
      throw new Error("CreateWindowExW failed");
    }

    this.editor = new Editor(this.editorHwnd);
    this.menu = createAppMenu();
    User32.SetMenu(this.hwnd, this.menu.menuBar);
    User32.DrawMenuBar(this.hwnd);

    User32.ShowWindow(this.hwnd, ShowWindowCommand.SW_SHOW);
    User32.UpdateWindow(this.hwnd);
    this.refreshTitle();
  }

  static create(options: MainWindowOptions = {}): MainWindow {
    return new MainWindow(options);
  }

  get handle(): bigint {
    return this.hwnd;
  }

  get editorHandle(): bigint {
    return this.editorHwnd;
  }

  get pumpContext(): MessagePumpContext {
    return { hwnd: this.hwnd, hAccel: this.menu.accelTable };
  }

  private handleMessage(
    hWnd: bigint,
    msg: number,
    wParam: bigint,
    lParam: bigint,
  ): bigint {
    switch (msg) {
      case MessageFilter.WM_CREATE:
        this.createEditor(hWnd);
        return 0n;

      case MessageFilter.WM_SIZE:
        this.resizeEditor(hWnd);
        return 0n;

      case WM_COMMAND: {
        const notifyCode = Number((wParam >> 16n) & 0xffffn);
        const commandId = Number(wParam & 0xffffn);

        if (notifyCode === EN_CHANGE && lParam === this.editorHwnd) {
          this.document.markDirty();
          this.refreshTitle();
          return 0n;
        }

        if (notifyCode === 0) {
          void this.dispatchCommand(commandId);
        }

        return 0n;
      }

      case WM_CLOSE:
        User32.DestroyWindow(hWnd);
        return 0n;

      case MessageFilter.WM_DESTROY:
        this.hwnd = 0n;
        this.editorHwnd = 0n;
        this.editor = null;
        this.onClose?.();
        User32.PostQuitMessage(0);
        return 0n;

      default:
        return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
    }
  }

  private createEditor(parentHwnd: bigint): void {
    if (this.editorHwnd) {
      return;
    }

    this.editorHwnd = User32.CreateWindowExW(
      0,
      this.editorClassBuf.ptr!,
      NULL_PTR,
      EDITOR_WINDOW_STYLES | EDITOR_STYLE_FLAGS,
      0,
      0,
      0,
      0,
      parentHwnd,
      NULL,
      NULL,
      NULL_PTR,
    );

    if (!this.editorHwnd) {
      throw new Error(
        `CreateWindowExW(${this.useRichEdit ? RICHEDIT_CLASS : FALLBACK_EDIT_CLASS}) failed`,
      );
    }

    this.editor = new Editor(this.editorHwnd);
    this.resizeEditor(parentHwnd);
  }

  private resizeEditor(parentHwnd: bigint): void {
    if (!this.editorHwnd) {
      return;
    }

    const rect = Buffer.alloc(16);
    if (!User32.GetClientRect(parentHwnd, rect.ptr!)) {
      return;
    }

    const width = rect.readInt32LE(8) - rect.readInt32LE(0);
    const height = rect.readInt32LE(12) - rect.readInt32LE(4);
    User32.MoveWindow(this.editorHwnd, 0, 0, width, height, 1);
  }

  private refreshTitle(): void {
    const dirtyMark = this.document.dirty ? " *" : "";
    this.titleBuf = encodeWide(
      `${this.document.displayName()}${dirtyMark} — BunPad`,
    );
    User32.SetWindowTextW(this.hwnd, this.titleBuf.ptr!);
  }

  private showError(message: string): void {
    const text = encodeWide(message);
    const caption = encodeWide("BunPad");
    User32.MessageBoxW(
      this.hwnd,
      text.ptr!,
      caption.ptr!,
      MessageBoxType.MB_OK | MessageBoxType.MB_ICONERROR,
    );
  }

  private async dispatchCommand(commandId: number): Promise<void> {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    try {
      switch (commandId) {
        case MenuCommand.FileNew:
          editor.setText("");
          this.document.reset();
          this.refreshTitle();
          break;

        case MenuCommand.FileOpen:
          await this.openFile();
          break;

        case MenuCommand.FileSave:
          await this.saveFile(false);
          break;

        case MenuCommand.FileSaveAs:
          await this.saveFile(true);
          break;

        case MenuCommand.FileExit:
          User32.PostMessageW(this.hwnd, WM_CLOSE, 0n, 0n);
          break;

        case MenuCommand.EditSelectAll:
          editor.selectAll();
          break;

        default:
          break;
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  private async openFile(): Promise<void> {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    const path = showOpenDialog(this.hwnd, this.document.path);
    if (!path) {
      return;
    }

    const text = await this.document.readFromDisk(path);
    editor.setText(text);
    this.refreshTitle();
  }

  private async saveFile(saveAs: boolean): Promise<void> {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    let path = this.document.path;
    if (saveAs || !path) {
      path = showSaveDialog(this.hwnd, path);
      if (!path) {
        return;
      }
    }

    await this.document.writeToDisk(path, editor.getText());
    this.refreshTitle();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    if (this.menu.accelTable) {
      User32.DestroyAcceleratorTable(this.menu.accelTable);
    }

    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      this.hwnd = 0n;
    }

    this.editorHwnd = 0n;
    this.editor = null;
    User32.UnregisterClassW(this.classNameBuf.ptr!, NULL);
    this.wndProc.close();

    if (this.msfteditModule) {
      Kernel32.FreeLibrary(this.msfteditModule);
      this.msfteditModule = 0n;
    }
  }
}
