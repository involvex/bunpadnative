import User32, { MessageFilter } from "@bun-win32/user32";

import { encodeWide } from "../win32/strings";
import { pointerToBigInt } from "../win32/pointers";

/** EM_GETSEL / EM_SETSEL — query or set character selection range. */
const EM_GETSEL = 0x00b0;
const EM_SETSEL = 0x00b1;

/** EM_LINEFROMCHAR / EM_LINEINDEX — map character index to line/column. */
const EM_LINEFROMCHAR = 0x00c9;
const EM_LINEINDEX = 0x00bb;

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
}
