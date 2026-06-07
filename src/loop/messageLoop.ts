import User32, { PeekMessageRemoveFlag } from "@bun-win32/user32";

/** MSG structure is 48 bytes on x64. */
const MSG_SIZE = 48;

/** Drain the Win32 queue without blocking Bun's async event loop. */
export async function runMessagePump(
  shouldRun: () => boolean,
): Promise<void> {
  const msg = Buffer.alloc(MSG_SIZE);

  while (shouldRun()) {
    while (
      User32.PeekMessageW(
        msg.ptr!,
        0n,
        0,
        0,
        PeekMessageRemoveFlag.PM_REMOVE,
      ) !== 0
    ) {
      User32.TranslateMessage(msg.ptr!);
      User32.DispatchMessageW(msg.ptr!);
    }

    await Bun.sleep(1);
  }
}

/** Single non-blocking pump pass for use before/after async I/O (Phase 2). */
export const pumpOnce = (): void => {
  const msg = Buffer.alloc(MSG_SIZE);

  while (
    User32.PeekMessageW(
      msg.ptr!,
      0n,
      0,
      0,
      PeekMessageRemoveFlag.PM_REMOVE,
    ) !== 0
  ) {
    User32.TranslateMessage(msg.ptr!);
    User32.DispatchMessageW(msg.ptr!);
  }
};
