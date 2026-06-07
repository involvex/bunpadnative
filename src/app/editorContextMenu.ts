import User32 from "@bun-win32/user32";

import {
  TPM_LEFTALIGN,
  TPM_RETURNCMD,
  TPM_TOPALIGN,
  TPM_VERTICAL,
} from "../win32/layout";

const WM_NULL = 0x0000;

/** Shows a TrackPopupMenu context menu at screen coordinates. */
export const trackContextMenuCommand = (
  menu: bigint,
  owner: bigint,
  screenX: number,
  screenY: number,
): number => {
  User32.SetForegroundWindow(owner);
  const cmd = User32.TrackPopupMenu(
    menu,
    TPM_RETURNCMD | TPM_LEFTALIGN | TPM_TOPALIGN | TPM_VERTICAL,
    screenX,
    screenY,
    0,
    owner,
    null,
  );
  User32.PostMessageW(owner, WM_NULL, 0n, 0n);
  return Number(cmd);
};
