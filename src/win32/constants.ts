import { WindowStyles } from "@bun-win32/user32";

/** CreateWindowExW default placement sentinel (0x80000000). */
export const CW_USEDEFAULT = 0x8000_0000;

/** Frame window messages not present on MessageFilter enum. */
export const WM_CLOSE = 0x0010;
export const WM_COMMAND = 0x0111;
export const WM_DESTROY = 0x0002;

/** App-private: defer menu command dispatch until after TrackPopupMenu returns. */
export const WM_APP_DEFER_COMMAND = 0x8000 + 100;

/** Shell_NotifyIconW callback message (WM_USER + 1). */
export const WM_TRAYICON = 0x0400 + 1;

export const WM_SYSCOMMAND = 0x0112;

/** WM_SYSCOMMAND minimize — hide to tray instead of taskbar minimize. */
export const SC_MINIMIZE = 0xf020;

/** Dialog class background — (HBRUSH)(COLOR_BTNFACE + 1). */
export const DIALOG_BACKGROUND_BRUSH = 16;

/** EDIT/RICHEDIT notification codes (HIWORD of WM_COMMAND wParam). */
export const EN_CHANGE = 0x0300;

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
