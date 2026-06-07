import User32, { MessageFilter } from "@bun-win32/user32";

import { encodeWide } from "../win32/strings";
import { pointerToBigInt } from "../win32/pointers";

/** EM_GETSEL / EM_SETSEL — query or set character selection range. */
const EM_GETSEL = 0x00b0;
const EM_SETSEL = 0x00b1;

/** EM_LINEFROMCHAR / EM_LINEINDEX — map character index to line/column. */
const EM_LINEFROMCHAR = 0x00c9;
const EM_LINEINDEX = 0x00bb;

/** Clipboard and undo messages for EDIT/RICHEDIT controls. */
const WM_UNDO = 0x0304;
const WM_CUT = 0x0300;
const WM_COPY = 0x0301;
const WM_PASTE = 0x0302;
const EM_CANUNDO = 0x00c6;
const EM_REDO = 0x0454;

/** Native RichEdit / EDIT control text buffer wrapper. */
export class Editor {
  constructor(readonly hwnd: bigint) {}

  getText(): string {
    const length = Number(
      User32.SendMessageW(this.hwnd, MessageFilter.WM_GETTEXTLENGTH, 0n, 0n),
    );

    if (length <= 0) {
      return "";
    }

    const buf = Buffer.alloc((length + 1) * 2);
    User32.SendMessageW(
      this.hwnd,
      MessageFilter.WM_GETTEXT,
      BigInt(length + 1),
      pointerToBigInt(buf),
    );

    return new TextDecoder("utf-16le").decode(buf).replace(/\0.*$/, "");
  }

  setText(text: string): void {
    const wide = encodeWide(text);
    User32.SendMessageW(
      this.hwnd,
      MessageFilter.WM_SETTEXT,
      0n,
      pointerToBigInt(wide),
    );
  }

  getCursorPosition(): number {
    const startBuf = Buffer.alloc(4);
    const endBuf = Buffer.alloc(4);
    User32.SendMessageW(
      this.hwnd,
      EM_GETSEL,
      pointerToBigInt(startBuf),
      pointerToBigInt(endBuf),
    );
    return startBuf.readInt32LE(0);
  }

  getSelection(): { start: number; end: number } {
    const startBuf = Buffer.alloc(4);
    const endBuf = Buffer.alloc(4);
    User32.SendMessageW(
      this.hwnd,
      EM_GETSEL,
      pointerToBigInt(startBuf),
      pointerToBigInt(endBuf),
    );
    return {
      start: startBuf.readInt32LE(0),
      end: endBuf.readInt32LE(0),
    };
  }

  setSelection(start: number, end: number): void {
    User32.SendMessageW(this.hwnd, EM_SETSEL, BigInt(start), BigInt(end));
  }

  replaceRange(start: number, end: number, replacement: string): void {
    const text = this.getText();
    const next = text.slice(0, start) + replacement + text.slice(end);
    this.setText(next);
    const cursor = start + replacement.length;
    this.setSelection(cursor, cursor);
  }

  getLineColumn(): { line: number; column: number } {
    const pos = this.getCursorPosition();
    const line = Number(
      User32.SendMessageW(this.hwnd, EM_LINEFROMCHAR, BigInt(pos), 0n),
    );
    const lineStart = Number(
      User32.SendMessageW(this.hwnd, EM_LINEINDEX, BigInt(line), 0n),
    );
    return { line: line + 1, column: pos - lineStart + 1 };
  }

  selectAll(): void {
    User32.SendMessageW(this.hwnd, EM_SETSEL, 0n, -1n);
  }

  undo(): void {
    User32.SendMessageW(this.hwnd, WM_UNDO, 0n, 0n);
  }

  redo(): void {
    User32.SendMessageW(this.hwnd, EM_REDO, 0n, 0n);
  }

  cut(): void {
    User32.SendMessageW(this.hwnd, WM_CUT, 0n, 0n);
  }

  copy(): void {
    User32.SendMessageW(this.hwnd, WM_COPY, 0n, 0n);
  }

  paste(): void {
    User32.SendMessageW(this.hwnd, WM_PASTE, 0n, 0n);
  }

  canUndo(): boolean {
    return User32.SendMessageW(this.hwnd, EM_CANUNDO, 0n, 0n) !== 0n;
  }

  /** Find needle after selection end; wraps to document start when needed. */
  findNext(needle: string, matchCase = false): boolean {
    if (!needle) {
      return false;
    }

    const text = this.getText();
    const { end } = this.getSelection();
    const from = Math.max(0, end);

    const index = indexOfNeedle(text, needle, from, matchCase);
    if (index >= 0) {
      this.setSelection(index, index + needle.length);
      return true;
    }

    if (from > 0) {
      const wrapped = indexOfNeedle(text, needle, 0, matchCase);
      if (wrapped >= 0) {
        this.setSelection(wrapped, wrapped + needle.length);
        return true;
      }
    }

    return false;
  }

  /** Replace current selection when it matches needle; otherwise find next. */
  replaceOne(needle: string, replacement: string, matchCase = false): boolean {
    if (!needle) {
      return false;
    }

    const { start, end } = this.getSelection();
    const selected = this.getText().slice(start, end);
    const matches = matchCase
      ? selected === needle
      : selected.toLowerCase() === needle.toLowerCase();

    if (matches) {
      this.replaceRange(start, end, replacement);
      return true;
    }

    return this.findNext(needle, matchCase);
  }

  replaceAll(needle: string, replacement: string, matchCase = false): number {
    if (!needle) {
      return 0;
    }

    const source = this.getText();
    let count = 0;
    let cursor = 0;
    let result = "";

    while (cursor <= source.length) {
      const index = indexOfNeedle(source, needle, cursor, matchCase);
      if (index < 0) {
        result += source.slice(cursor);
        break;
      }

      result += source.slice(cursor, index) + replacement;
      cursor = index + needle.length;
      count += 1;
    }

    if (count > 0) {
      this.setText(result);
    }

    return count;
  }
}

const indexOfNeedle = (
  haystack: string,
  needle: string,
  from: number,
  matchCase: boolean,
): number => {
  if (matchCase) {
    return haystack.indexOf(needle, from);
  }

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  return lowerHaystack.indexOf(lowerNeedle, from);
};
