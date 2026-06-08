import type { EditorSettings } from "../theme/types";
import type { LanguageId } from "../highlight/types";
import {
  isBracketContextAllowed,
  isBracketIndexInCode,
  tokenizeForContext,
} from "./tokenContext";

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

export type BracketContext = {
  text: string;
  cursor: number;
  language: LanguageId;
};

/** When user types an opening delimiter, return text to insert and cursor position. */
export const autoCloseForChar = (
  char: string,
  settings: EditorSettings,
  hasSelection: boolean,
  context?: BracketContext,
): AutoCloseResult | null => {
  if (!settings.autoCloseBrackets || hasSelection) {
    return null;
  }

  if (
    context &&
    !isBracketContextAllowed(context.text, context.cursor, context.language)
  ) {
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
  language: LanguageId = "plain",
): BracketMatch | null => {
  if (cursor < 0 || cursor > text.length) {
    return null;
  }

  const tokens = tokenizeForContext(text, language);

  const at = text[cursor] ?? text[cursor - 1];
  if (!at) {
    return null;
  }

  if (OPENERS.has(at)) {
    const index = text[cursor] === at ? cursor : cursor - 1;
    if (!isBracketIndexInCode(index, tokens)) {
      return null;
    }

    const close = OPEN_TO_CLOSE[at]!;
    let depth = 0;
    for (let pos = index; pos < text.length; pos += 1) {
      if (!isBracketIndexInCode(pos, tokens)) {
        continue;
      }

      const ch = text[pos]!;
      if (ch === at) {
        depth += 1;
      } else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          return { open: index, close: pos };
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

    if (!isBracketIndexInCode(index, tokens)) {
      return null;
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
      if (!isBracketIndexInCode(pos, tokens)) {
        continue;
      }

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
