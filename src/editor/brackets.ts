import type { EditorSettings } from "../theme/types";

const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "'": "'",
  '"': '"',
  "`": "`",
};

const CLOSERS = new Set(Object.values(OPEN_TO_CLOSE));
const OPENERS = new Set(Object.keys(OPEN_TO_CLOSE));

export type AutoCloseResult = {
  insert: string;
  cursorOffset: number;
};

/** When user types an opening delimiter, return text to insert and cursor position. */
export const autoCloseForChar = (
  char: string,
  settings: EditorSettings,
  hasSelection: boolean,
): AutoCloseResult | null => {
  if (!settings.autoCloseBrackets || hasSelection) {
    return null;
  }

  const close = OPEN_TO_CLOSE[char];
  if (!close) {
    return null;
  }

  return {
    insert: char + close,
    cursorOffset: 1,
  };
};

export type BracketMatch = {
  open: number;
  close: number;
};

const matchesPair = (open: string, close: string): boolean =>
  OPEN_TO_CLOSE[open] === close;

/** Find matching bracket for cursor position, if any. */
export const findMatchingBracket = (
  text: string,
  cursor: number,
): BracketMatch | null => {
  if (cursor < 0 || cursor > text.length) {
    return null;
  }

  const at = text[cursor] ?? text[cursor - 1];
  if (!at) {
    return null;
  }

  if (OPENERS.has(at)) {
    const close = OPEN_TO_CLOSE[at]!;
    let depth = 0;
    for (let index = cursor; index < text.length; index += 1) {
      const ch = text[index]!;
      if (ch === at) {
        depth += 1;
      } else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          return { open: cursor, close: index };
        }
      }
    }
    return null;
  }

  if (CLOSERS.has(at)) {
    let index = cursor - 1;
    if (text[cursor] && CLOSERS.has(text[cursor]!)) {
      index = cursor;
    }

    const closer = text[index]!;
    const opener = Object.entries(OPEN_TO_CLOSE).find(
      ([, close]) => close === closer,
    )?.[0];
    if (!opener) {
      return null;
    }

    let depth = 0;
    for (let pos = index; pos >= 0; pos -= 1) {
      const ch = text[pos]!;
      if (ch === closer && matchesPair(opener, closer)) {
        depth += 1;
      } else if (ch === opener) {
        depth -= 1;
        if (depth === 0) {
          return { open: pos, close: index };
        }
      }
    }
  }

  return null;
};

/** Skip bracket logic when settings disabled. */
export const shouldMatchBrackets = (settings: EditorSettings): boolean =>
  settings.bracketMatching;
