import User32, { PeekMessageRemoveFlag } from "@bun-win32/user32";

import { isModalDialogOpen } from "../ui/modalGuard";
import { ffiPtr } from "../win32/pointers";

/** MSG structure is 48 bytes on x64. */
const MSG_SIZE = 48;

export type MessagePumpContext = {
  hwnd: bigint;
  hAccel?: bigint;
};

const dispatchMessage = (msg: Buffer, ctx?: MessagePumpContext): void => {
  if (ctx?.hAccel && ctx.hwnd && !isModalDialogOpen()) {
    const translated = User32.TranslateAcceleratorW(
      ctx.hwnd,
      ctx.hAccel,
      ffiPtr(msg),
    );
    if (translated !== 0) {
      return;
    }
  }

  User32.TranslateMessage(ffiPtr(msg));
  User32.DispatchMessageW(ffiPtr(msg));
};

/** Drain the Win32 queue without blocking Bun's async event loop. */
export async function runMessagePump(
  shouldRun: () => boolean,
  ctx?: MessagePumpContext,
): Promise<void> {
  const msg = Buffer.alloc(MSG_SIZE);

  while (shouldRun()) {
    while (
      User32.PeekMessageW(
        ffiPtr(msg),
        0n,
        0,
        0,
        PeekMessageRemoveFlag.PM_REMOVE,
      ) !== 0
    ) {
      dispatchMessage(msg, ctx);
    }

    await Bun.sleep(1);
  }
}

/** Single non-blocking pump pass for use before/after async I/O. */
export const pumpOnce = (ctx?: MessagePumpContext): void => {
  const msg = Buffer.alloc(MSG_SIZE);

  while (
    User32.PeekMessageW(
      ffiPtr(msg),
      0n,
      0,
      0,
      PeekMessageRemoveFlag.PM_REMOVE,
    ) !== 0
  ) {
    dispatchMessage(msg, ctx);
  }
};
