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
import {
  createAppMenus,
  MenuCommand,
  type AppMenus,
} from "./menu";
import { showOpenDialog, showSaveDialog } from "../io/dialog";
import type { MessagePumpContext } from "../loop/messageLoop";
import { EditorContextImpl } from "../plugins/context";
import type { ExtensionHost } from "../extensions/host";
import { ExtensionMenuCommand } from "../extensions/host";
import type { PluginHost } from "../plugins/host";
import { vscodeBridge } from "../vscode/bridge";
import type { ThemeController } from "../theme/controller";
import { hexToColorRef } from "../theme/colors";
import { MenuBar } from "../ui/menuBar";
import { StatusBar } from "../ui/statusBar";
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
import {
  MENU_BAR_HEIGHT,
  STATUS_BAR_HEIGHT,
  WM_CTLCOLOREDIT,
} from "../win32/layout";
import { setTextColor } from "../win32/gdi32";
import { encodeWide, ffiPtr } from "../win32/strings";
import { packWndClassEx } from "../win32/wndclass";

const NULL = 0n;
const NULL_PTR = null as unknown as Pointer;

export type MainWindowOptions = {
  title?: string;
  width?: number;
  height?: number;
  pluginHost?: PluginHost;
  themeController?: ThemeController;
  extensionHost?: ExtensionHost;
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
  private readonly menus: AppMenus;
  private readonly pluginHost?: PluginHost;
  private readonly extensionHost?: ExtensionHost;
  private readonly themeController?: ThemeController;
  private editorContext: EditorContextImpl | null = null;
  private menuBar: MenuBar | null = null;
  private statusBar: StatusBar | null = null;

  readonly document = new Document();
  editor: Editor | null = null;

  onClose?: () => void;

  private constructor(options: MainWindowOptions) {
    const title = options.title ?? "BunPad Native";
    this.titleBuf = encodeWide(title);
    this.pluginHost = options.pluginHost;
    this.extensionHost = options.extensionHost;
    this.themeController = options.themeController;

    this.msfteditModule = Kernel32.LoadLibraryW(
      ffiPtr(encodeWide("Msftedit.dll")),
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
      this.classNameBuf,
      CS_HREDRAW | CS_VREDRAW,
    );

    const classAtom = User32.RegisterClassExW(ffiPtr(this.wndClassBuf));
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
      ffiPtr(this.classNameBuf),
      ffiPtr(this.titleBuf),
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
      User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
      this.wndProc.close();
      if (this.msfteditModule) {
        Kernel32.FreeLibrary(this.msfteditModule);
      }
      throw new Error("CreateWindowExW failed");
    }

    if (!options.themeController) {
      throw new Error("ThemeController is required");
    }

    const theme = options.themeController.current();

    this.menus = createAppMenus(
      options.themeController.manager.summaries,
      options.extensionHost?.contributedCommands ?? [],
    );
    this.menuBar = new MenuBar(
      this.hwnd,
      [
        { label: "File", menu: this.menus.fileMenu },
        { label: "Edit", menu: this.menus.editMenu },
        { label: "View", menu: this.menus.viewMenu },
        { label: "Plugins", menu: this.menus.pluginsMenu },
      ],
      (commandId) => {
        void this.dispatchCommand(commandId);
      },
      theme,
    );
    this.menuBar.create();

    this.statusBar = new StatusBar(this.hwnd, theme);
    this.statusBar.create();

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
    return { hwnd: this.hwnd, hAccel: this.menus.accelTable };
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
        this.layoutClient(hWnd);
        return 0n;

      case WM_CTLCOLOREDIT: {
        if (!this.useRichEdit && lParam === this.editorHwnd && this.themeController) {
          setTextColor(
            wParam,
            hexToColorRef(this.themeController.current().editor.foreground),
          );
          return this.themeController.getEditBrush();
        }
        return User32.DefWindowProcW(hWnd, msg, wParam, lParam);
      }

      case WM_COMMAND: {
        const notifyCode = Number((wParam >> 16n) & 0xffffn);
        const commandId = Number(wParam & 0xffffn);

        if (notifyCode === EN_CHANGE && lParam === this.editorHwnd) {
          this.document.markDirty();
          this.refreshTitle();
          this.refreshStatus();
          if (this.editorContext && this.pluginHost) {
            this.pluginHost.scheduleTextChange(this.editorContext);
          }
          vscodeBridge.notifyDocumentChanged();
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
        this.editorContext = null;
        vscodeBridge.clear();
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
      ffiPtr(this.editorClassBuf),
      NULL_PTR,
      EDITOR_WINDOW_STYLES | EDITOR_STYLE_FLAGS,
      0,
      MENU_BAR_HEIGHT,
      100,
      100,
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
    this.editorContext = this.buildEditorContext();
    vscodeBridge.bind(this.editor, this.document, this.hwnd);
    this.layoutClient(parentHwnd);
    this.applyCurrentTheme();
    this.refreshStatus();
    void this.pluginHost?.activateAll(this.editorContext);
    void this.extensionHost?.activateStartup();
  }

  private layoutClient(parentHwnd: bigint): void {
    const rect = Buffer.alloc(16);
    if (!User32.GetClientRect(parentHwnd, ffiPtr(rect))) {
      return;
    }

    const width = rect.readInt32LE(8) - rect.readInt32LE(0);
    const height = rect.readInt32LE(12) - rect.readInt32LE(4);
    const editorHeight = Math.max(
      0,
      height - MENU_BAR_HEIGHT - STATUS_BAR_HEIGHT,
    );

    this.menuBar?.resize(width);

    if (this.editorHwnd) {
      User32.MoveWindow(
        this.editorHwnd,
        0,
        MENU_BAR_HEIGHT,
        width,
        editorHeight,
        1,
      );
    }

    this.statusBar?.resize(width, height - STATUS_BAR_HEIGHT);
  }

  private applyCurrentTheme(): void {
    if (!this.themeController || !this.editor) {
      return;
    }

    this.themeController.applyToWindow(
      this.hwnd,
      this.editor,
      this.useRichEdit,
    );

    const theme = this.themeController.current();
    this.menuBar?.setTheme(theme);
    this.statusBar?.setTheme(theme);
    this.refreshStatus();
  }

  private buildEditorContext(): EditorContextImpl {
    return new EditorContextImpl(
      this.editor!,
      this.document,
      (message) => this.showInfo(message),
    );
  }

  private refreshTitle(): void {
    const dirtyMark = this.document.dirty ? " *" : "";
    this.titleBuf = encodeWide(
      `${this.document.displayName()}${dirtyMark} — BunPad`,
    );
    User32.SetWindowTextW(this.hwnd, ffiPtr(this.titleBuf));
  }

  private refreshStatus(): void {
    if (!this.statusBar) {
      return;
    }

    const dirtyMark = this.document.dirty ? " *" : "";
    this.statusBar.setLeft(`${this.document.displayName()}${dirtyMark}`);

    const themeName = this.themeController?.current().name ?? "";
    if (this.editor) {
      const { line, column } = this.editor.getLineColumn();
      this.statusBar.setRight(`Ln ${line}, Col ${column}  |  ${themeName}`);
    } else {
      this.statusBar.setRight(themeName);
    }
  }

  private showInfo(message: string): void {
    const text = encodeWide(message);
    const caption = encodeWide("BunPad");
    User32.MessageBoxW(
      this.hwnd,
      ffiPtr(text),
      ffiPtr(caption),
      MessageBoxType.MB_OK | MessageBoxType.MB_ICONINFORMATION,
    );
  }

  private showError(message: string): void {
    const text = encodeWide(message);
    const caption = encodeWide("BunPad");
    User32.MessageBoxW(
      this.hwnd,
      ffiPtr(text),
      ffiPtr(caption),
      MessageBoxType.MB_OK | MessageBoxType.MB_ICONERROR,
    );
  }

  private async dispatchCommand(commandId: number): Promise<void> {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    try {
      if (
        commandId >= MenuCommand.ThemeCommandBase &&
        commandId < MenuCommand.ViewReloadThemes
      ) {
        await this.selectThemeByCommand(commandId);
        return;
      }

      if (
        commandId >= ExtensionMenuCommand.CommandBase &&
        commandId <= ExtensionMenuCommand.CommandMax
      ) {
        await this.extensionHost?.executeMenuCommand(commandId);
        return;
      }

      switch (commandId) {
        case MenuCommand.FileNew:
          editor.setText("");
          this.document.reset();
          this.refreshTitle();
          this.refreshStatus();
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

        case MenuCommand.PluginsReload:
          await this.reloadPlugins();
          break;

        case ExtensionMenuCommand.Reload:
          await this.reloadExtensions();
          break;

        case MenuCommand.ViewReloadThemes:
          await this.reloadThemes();
          break;

        case MenuCommand.ViewOpenThemesFolder:
          this.openThemesFolder();
          break;

        default:
          break;
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  private async selectThemeByCommand(commandId: number): Promise<void> {
    const themeId =
      this.themeController?.manager.themeIdForCommand(commandId);
    if (!themeId || !this.themeController) {
      return;
    }

    await this.themeController.selectTheme(themeId);
    this.applyCurrentTheme();
    if (this.editorContext && this.pluginHost) {
      await this.pluginHost.emitThemeChange(this.editorContext);
    }
  }

  private async reloadThemes(): Promise<void> {
    if (!this.themeController) {
      return;
    }

    const count = await this.themeController.reload();
    this.applyCurrentTheme();
    this.showInfo(`Reloaded ${count} theme(s).`);
  }

  private openThemesFolder(): void {
    const folder = this.themeController?.manager.userThemesFolder();
    if (!folder) {
      return;
    }
    Bun.spawn(["explorer.exe", folder]);
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
    this.refreshStatus();
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

    await this.document.writeToDisk(
      path,
      this.editorContext && this.pluginHost
        ? await this.pluginHost.runBeforeSave(
            this.editorContext,
            editor.getText(),
          )
        : editor.getText(),
    );
    this.refreshTitle();
    this.refreshStatus();
  }

  private async reloadPlugins(): Promise<void> {
    if (!this.pluginHost || !this.editorContext) {
      return;
    }

    const count = await this.pluginHost.loadAll();
    await this.pluginHost.activateAll(this.editorContext);
    this.showInfo(`Reloaded ${count} plugin(s).`);
  }

  private async reloadExtensions(): Promise<void> {
    if (!this.extensionHost) {
      return;
    }

    const count = await this.extensionHost.loadAll();
    if (this.editor && this.document) {
      vscodeBridge.bind(this.editor, this.document, this.hwnd);
    }
    await this.extensionHost.activateStartup();
    this.showInfo(
      `Reloaded ${count} VS Code extension(s). Restart BunPad to refresh extension menu items.`,
    );
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    this.themeController?.destroy();
    this.menuBar?.destroy();
    this.statusBar?.destroy();
    this.menuBar = null;
    this.statusBar = null;

    if (this.menus.accelTable) {
      User32.DestroyAcceleratorTable(this.menus.accelTable);
    }

    if (this.hwnd) {
      User32.DestroyWindow(this.hwnd);
      this.hwnd = 0n;
    }

    this.editorHwnd = 0n;
    this.editor = null;
    this.editorContext = null;
    User32.UnregisterClassW(ffiPtr(this.classNameBuf), NULL);
    this.wndProc.close();

    if (this.msfteditModule) {
      Kernel32.FreeLibrary(this.msfteditModule);
      this.msfteditModule = 0n;
    }
  }
}
