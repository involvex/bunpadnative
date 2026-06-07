import User32, { MessageFilter } from "@bun-win32/user32";

import { encodeWide } from "../win32/strings";

/** EM_SETSEL — select character range; end = -1 selects through EOF. */
const EM_SETSEL = 0x00b1;

/** Native RichEdit / EDIT control text buffer wrapper. */
export class Editor {
  constructor(readonly hwnd: bigint) {}

  getText(): string {
    const length = Number(
      User32.SendMessageW(
        this.hwnd,
        MessageFilter.WM_GETTEXTLENGTH,
        0n,
        0n,
      ),
    );

    if (length <= 0) {
      return "";
    }

    const buf = Buffer.alloc((length + 1) * 2);
    User32.SendMessageW(
      this.hwnd,
      MessageFilter.WM_GETTEXT,
      BigInt(length + 1),
      BigInt(buf.ptr!),
    );

    return new TextDecoder("utf-16le").decode(buf).replace(/\0.*$/, "");
  }

  setText(text: string): void {
    const wide = encodeWide(text);
    User32.SendMessageW(
      this.hwnd,
      MessageFilter.WM_SETTEXT,
      0n,
      BigInt(wide.ptr!),
    );
  }

  selectAll(): void {
    User32.SendMessageW(this.hwnd, EM_SETSEL, 0n, -1n);
  }
}
