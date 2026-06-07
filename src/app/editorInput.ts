import User32 from "@bun-win32/user32";
import { dlopen, FFIType, read } from "bun:ffi";
import type { Pointer } from "bun:ffi";

import { MenuCommand } from "./menu";
import { ffiPtr } from "../win32/strings";

/** RichEdit EM_SETEVENTMASK — enable parent EN_MSGFILTER notifications. */
const EM_SETEVENTMASK = 0x0445; // WM_USER + 69 per richedit.h
const ENM_MOUSEEVENTS = 0x00000001;
const ENM_KEYEVENTS = 0x00010000;

export const WM_NOTIFY = 0x004e;
export const EN_MSGFILTER = 0x0700;

const WM_KEYDOWN = 0x0100;
const WM_KEYUP = 0x0101;
const WM_SYSKEYDOWN = 0x0104;
const WM_SYSKEYUP = 0x0105;
const WM_RBUTTONDOWN = 0x0204;
const WM_RBUTTONUP = 0x0205;
export const WM_CONTEXTMENU = 0x007b;

/** Screen coords from WM_CONTEXTMENU lParam (-1 uses cursor position). */
export const contextMenuScreenPoint = (
  lParam: bigint,
): { screenX: number; screenY: number } => {
  if (lParam === -1n) {
    const point = Buffer.alloc(8);
    User32.GetCursorPos(ffiPtr(point));
    return {
      screenX: point.readInt32LE(0),
      screenY: point.readInt32LE(4),
    };
  }

  let screenX = Number(lParam & 0xffffn);
  let screenY = Number((lParam >> 16n) & 0xffffn);
  if (screenX > 0x7fff) {
    screenX -= 0x10000;
  }
  if (screenY > 0x7fff) {
    screenY -= 0x10000;
  }
  return { screenX, screenY };
};

/** Modifier keys — not application shortcuts. */
const MODIFIER_VKS = new Set([0x10, 0x11, 0x12]);

const VK_CONTROL = 0x11;

/** NMHDR.code offset; MSGFILTER fields follow 24-byte NMHDR on x64 (no padding after msg). */
const MSGFILTER_MSG_OFFSET = 24;
const MSGFILTER_WPARAM_OFFSET = 28;
const MSGFILTER_LPARAM_OFFSET = 36;
const NMHDR_CODE_OFFSET = 16;
const NMHDR_HWNDFROM_OFFSET = 0;

const asNotifyPtr = (notifyPtr: bigint): Pointer =>
  Number(notifyPtr) as unknown as Pointer;

const MF_BYCOMMAND = 0x0000;
const MF_ENABLED = 0x0000;
const MF_GRAYED = 0x0001;

const user32Extra = dlopen("user32.dll", {
  GetAsyncKeyState: {
    args: [FFIType.i32],
    returns: FFIType.i16,
  },
  EnableMenuItem: {
    args: [FFIType.u64, FFIType.u32, FFIType.u32],
    returns: FFIType.i32,
  },
});

const isCtrlDown = (): boolean =>
  (user32Extra.symbols.GetAsyncKeyState(VK_CONTROL) & 0x8000) !== 0;

const isShortcutKeyMessage = (msg: number): boolean =>
  msg === WM_KEYDOWN ||
  msg === WM_KEYUP ||
  msg === WM_SYSKEYDOWN ||
  msg === WM_SYSKEYUP;

/** Map Ctrl+virtual-key to a MenuCommand id (matches accelerator table). */
export const resolveCtrlShortcut = (vk: number): number | null => {
  switch (vk) {
    case 0x41:
      return MenuCommand.EditSelectAll;
    case 0x43:
      return MenuCommand.EditCopy;
    case 0x56:
      return MenuCommand.EditPaste;
    case 0x58:
      return MenuCommand.EditCut;
    case 0x5a:
      return MenuCommand.EditUndo;
    case 0x59:
      return MenuCommand.EditRedo;
    case 0x46:
      return MenuCommand.EditFind;
    case 0x48:
      return MenuCommand.EditReplace;
    case 0x4e:
      return MenuCommand.FileNew;
    case 0x4f:
      return MenuCommand.FileOpen;
    case 0x53:
      return MenuCommand.FileSave;
    default:
      return null;
  }
};

export type EditorNotifyResult =
  | { handled: false }
  | { handled: true; commandId: number }
  | { handled: true; contextMenu: { screenX: number; screenY: number } };

/** Enable RichEdit key/mouse filter notifications on the editor control. */
export const enableEditorEventMask = (editorHwnd: bigint): void => {
  User32.SendMessageW(
    editorHwnd,
    EM_SETEVENTMASK,
    0n,
    BigInt(ENM_KEYEVENTS | ENM_MOUSEEVENTS),
  );
};

/** Parse WM_NOTIFY / EN_MSGFILTER from the parent window. */
export const handleEditorNotify = (
  notifyPtr: bigint,
  editorHwnd: bigint,
): EditorNotifyResult => {
  if (notifyPtr === 0n) {
    return { handled: false };
  }

  const ptr = asNotifyPtr(notifyPtr);
  const hwndFrom = BigInt(read.u64(ptr, NMHDR_HWNDFROM_OFFSET));
  if (hwndFrom !== BigInt(editorHwnd)) {
    return { handled: false };
  }

  const code = read.u32(ptr, NMHDR_CODE_OFFSET);
  if (code !== EN_MSGFILTER) {
    return { handled: false };
  }

  const msg = read.u32(ptr, MSGFILTER_MSG_OFFSET);
  const msgWParam = read.u32(ptr, MSGFILTER_WPARAM_OFFSET);
  const msgLParam = read.u64(ptr, MSGFILTER_LPARAM_OFFSET);

  if (isShortcutKeyMessage(msg) && isCtrlDown()) {
    const vk = msgWParam & 0xffff;
    if (!MODIFIER_VKS.has(vk)) {
      const commandId = resolveCtrlShortcut(vk);
      if (commandId !== null) {
        return { handled: true, commandId };
      }
    }
  }

  if (
    msg === WM_RBUTTONDOWN ||
    msg === WM_RBUTTONUP ||
    msg === WM_CONTEXTMENU
  ) {
    if (msg === WM_CONTEXTMENU) {
      const { screenX, screenY } = contextMenuScreenPoint(msgLParam);
      return { handled: true, contextMenu: { screenX, screenY } };
    }

    const point = Buffer.alloc(8);
    User32.GetCursorPos(ffiPtr(point));
    return {
      handled: true,
      contextMenu: {
        screenX: point.readInt32LE(0),
        screenY: point.readInt32LE(4),
      },
    };
  }

  return { handled: false };
};

/** Enable or gray context menu items before display. */
export const updateContextMenuState = (
  menu: bigint,
  options: { hasSelection: boolean; canUndo: boolean },
): void => {
  const setEnabled = (command: MenuCommand, enabled: boolean): void => {
    user32Extra.symbols.EnableMenuItem(
      menu,
      command,
      MF_BYCOMMAND | (enabled ? MF_ENABLED : MF_GRAYED),
    );
  };

  setEnabled(MenuCommand.EditUndo, options.canUndo);
  setEnabled(MenuCommand.EditCut, options.hasSelection);
  setEnabled(MenuCommand.EditCopy, options.hasSelection);
  setEnabled(MenuCommand.EditPaste, true);
  setEnabled(MenuCommand.EditRedo, true);
  setEnabled(MenuCommand.EditSelectAll, true);
};
