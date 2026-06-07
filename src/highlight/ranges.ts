import User32 from "@bun-win32/user32";

import type { Editor } from "../app/editor";
import type { ThemeDefinition } from "../theme/types";
import { ffiPtr } from "../win32/pointers";
import type { HighlightToken } from "./types";

const EM_GETLINECOUNT = 0x00ba;
const EM_GETFIRSTVISIBLELINE = 0x00ce;
const EM_LINEINDEX = 0x00bb;

const CONTEXT_LINES = 3;
const MIN_VISIBLE_LINES = 8;
const LINE_HEIGHT_PADDING = 4;

export type HighlightRange = {
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
};

export const getLineCount = (editor: Editor): number =>
  Number(User32.SendMessageW(editor.hwnd, EM_GETLINECOUNT, 0n, 0n));

export const getFirstVisibleLine = (editor: Editor): number =>
  Number(User32.SendMessageW(editor.hwnd, EM_GETFIRSTVISIBLELINE, 0n, 0n));

export const getLineStart = (editor: Editor, line: number): number =>
  Number(User32.SendMessageW(editor.hwnd, EM_LINEINDEX, BigInt(line), 0n));

export const getLineEnd = (editor: Editor, line: number): number => {
  const lineCount = getLineCount(editor);
  if (line + 1 < lineCount) {
    return getLineStart(editor, line + 1);
  }
  return editor.getText().length;
};

const estimateVisibleLines = (
  editor: Editor,
  theme: ThemeDefinition,
): number => {
  const rect = Buffer.alloc(16);
  if (!User32.GetClientRect(editor.hwnd, ffiPtr(rect))) {
    return MIN_VISIBLE_LINES;
  }

  const height = rect.readInt32LE(12) - rect.readInt32LE(4);
  const lineHeight = Math.max(12, theme.editor.fontSize + LINE_HEIGHT_PADDING);
  return Math.max(MIN_VISIBLE_LINES, Math.ceil(height / lineHeight));
};

/** Line span to re-tokenize: viewport union changed line ± context. */
export const computeHighlightRange = (
  editor: Editor,
  theme: ThemeDefinition,
  editLine?: number,
): HighlightRange => {
  const lineCount = Math.max(1, getLineCount(editor));
  const lastLine = lineCount - 1;
  const firstVisible = getFirstVisibleLine(editor);
  const visibleLines = estimateVisibleLines(editor, theme);

  let startLine = firstVisible;
  let endLine = Math.min(lastLine, firstVisible + visibleLines - 1);

  if (editLine !== undefined) {
    startLine = Math.min(startLine, Math.max(0, editLine - CONTEXT_LINES));
    endLine = Math.max(endLine, Math.min(lastLine, editLine + CONTEXT_LINES));
  }

  return {
    startLine,
    endLine,
    startChar: getLineStart(editor, startLine),
    endChar: getLineEnd(editor, endLine),
  };
};

export const offsetTokens = (
  tokens: HighlightToken[],
  delta: number,
): HighlightToken[] =>
  tokens.map((token) => ({
    kind: token.kind,
    start: token.start + delta,
    end: token.end + delta,
  }));
