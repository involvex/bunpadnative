import { WindowStyles } from "@bun-win32/user32";

/** CreateWindowExW default placement sentinel (0x80000000). */
export const CW_USEDEFAULT = 0x8000_0000;

/** Frame window messages not present on MessageFilter enum. */
export const WM_CLOSE = 0x0010;

/** WNDCLASSEXW.style — redraw client area on horizontal/vertical resize. */
export const CS_HREDRAW = 0x0002;
export const CS_VREDRAW = 0x0001;

/** EDIT/RICHEDIT style flags passed in CreateWindowExW dwStyle. */
export const ES_MULTILINE = 0x0004;
export const ES_AUTOVSCROLL = 0x0040;
export const ES_AUTOHSCROLL = 0x0080;
export const ES_WANTRETURN = 0x1000;

export const EDITOR_WINDOW_STYLES =
  WindowStyles.WS_CHILD |
  WindowStyles.WS_VISIBLE |
  WindowStyles.WS_VSCROLL |
  WindowStyles.WS_HSCROLL;

export const EDITOR_STYLE_FLAGS =
  ES_MULTILINE | ES_AUTOVSCROLL | ES_AUTOHSCROLL | ES_WANTRETURN;

export const RICHEDIT_CLASS = "RICHEDIT50W";
export const FALLBACK_EDIT_CLASS = "EDIT";
