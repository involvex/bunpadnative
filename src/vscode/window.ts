import User32, { MessageBoxType } from "@bun-win32/user32";

import { encodeWide, ffiPtr } from "../win32/strings";
import type { VscodeBridge } from "./bridge";

const showMessage = (
  bridge: VscodeBridge,
  message: string,
  caption: string,
  icon: number,
): void => {
  if (!bridge.messageParent) {
    console.log(`[${caption}] ${message}`);
    return;
  }

  const text = encodeWide(message);
  const title = encodeWide(caption);
  User32.MessageBoxW(bridge.messageParent, ffiPtr(text), ffiPtr(title), icon);
};

export const createWindowApi = (bridge: VscodeBridge) => ({
  get activeTextEditor() {
    return bridge.getActiveTextEditor();
  },

  get visibleTextEditors() {
    const editor = bridge.getActiveTextEditor();
    return editor ? [editor] : [];
  },

  showInformationMessage(message: string, ..._items: string[]): Promise<string | undefined> {
    showMessage(
      bridge,
      message,
      "BunPad",
      MessageBoxType.MB_OK | MessageBoxType.MB_ICONINFORMATION,
    );
    return Promise.resolve(undefined);
  },

  showWarningMessage(message: string, ..._items: string[]): Promise<string | undefined> {
    showMessage(
      bridge,
      message,
      "BunPad",
      MessageBoxType.MB_OK | MessageBoxType.MB_ICONWARNING,
    );
    return Promise.resolve(undefined);
  },

  showErrorMessage(message: string, ..._items: string[]): Promise<string | undefined> {
    showMessage(
      bridge,
      message,
      "BunPad",
      MessageBoxType.MB_OK | MessageBoxType.MB_ICONERROR,
    );
    return Promise.resolve(undefined);
  },

  createOutputChannel(name: string) {
    return {
      name,
      appendLine(value: string) {
        console.log(`[${name}] ${value}`);
      },
      append(value: string) {
        console.log(`[${name}] ${value}`);
      },
      show() {},
      dispose() {},
    };
  },
});

export type WindowApi = ReturnType<typeof createWindowApi>;
