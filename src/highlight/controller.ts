import User32 from "@bun-win32/user32";

import type { Editor } from "../app/editor";
import { hexToColorRef } from "../theme/colors";
import { packThemeEditorFormat } from "../theme/apply";
import type { ThemeDefinition } from "../theme/types";
import {
  setCharFormatAll,
  setCharFormatSelection,
  packTextColorFormat,
} from "../win32/charformat";
import { detectLanguageWithContent } from "./detect";
import { DEFAULT_TOKEN_COLORS } from "./defaults";
import { grammarFor } from "./languages";
import { computeHighlightRange, offsetTokens } from "./ranges";
import { coalesceTokens, tokenize } from "./tokenize";
import type {
  HighlightToken,
  LanguageId,
  LanguageMode,
  ThemeTokenColors,
  TokenKind,
} from "./types";
import { pointerToBigInt } from "../win32/pointers";

const EM_GETSEL = 0x00b0;
const EM_SETSEL = 0x00b1;
const EM_LINEFROMCHAR = 0x00c9;

export const INCREMENTAL_THRESHOLD = 5_000;
const LARGE_FILE_CHARS = 50_000;
const DEBOUNCE_MS = 120;

export type HighlightOptions = {
  full?: boolean;
  editLine?: number;
};

const tokenColorsFor = (theme: ThemeDefinition): ThemeTokenColors => ({
  ...DEFAULT_TOKEN_COLORS,
  ...theme.tokens,
});

const colorForKind = (kind: TokenKind, colors: ThemeTokenColors): number =>
  hexToColorRef(
    colors[kind] ?? DEFAULT_TOKEN_COLORS[kind] ?? colors.punctuation,
  );

/** Apply syntax colors to a RichEdit buffer via CHARFORMAT2 ranges. */
export class HighlightController {
  private language: LanguageId = "plain";
  private languageMode: LanguageMode = "auto";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private applying = false;
  private pendingEditLine: number | undefined;
  private readonly retain: Buffer[] = [];
  private documentPath: string | null = null;

  get currentLanguage(): LanguageId {
    return this.language;
  }

  get mode(): LanguageMode {
    return this.languageMode;
  }

  setLanguageMode(mode: LanguageMode, path: string | null): void {
    this.languageMode = mode;
    this.documentPath = path;
    this.language = this.resolveLanguage(path, mode, "");
  }

  setLanguageFromPath(path: string | null, text = ""): void {
    this.documentPath = path;
    this.language = this.resolveLanguage(path, this.languageMode, text);
  }

  schedule(
    editor: Editor,
    theme: ThemeDefinition,
    useRichEdit: boolean,
    editLine?: number,
  ): void {
    if (!useRichEdit || this.applying) {
      return;
    }

    if (editLine !== undefined) {
      this.pendingEditLine = editLine;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      const line = this.pendingEditLine;
      this.pendingEditLine = undefined;
      this.applyHighlight(editor, theme, { editLine: line });
    }, DEBOUNCE_MS);
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingEditLine = undefined;
  }

  applyHighlight(
    editor: Editor,
    theme: ThemeDefinition,
    options: HighlightOptions = { full: true },
  ): void {
    if (this.applying) {
      return;
    }

    this.applying = true;
    try {
      const text = editor.getText();
      if (this.languageMode === "auto") {
        this.language = detectLanguageWithContent(this.documentPath, text);
      }

      const grammar = grammarFor(this.language);
      const fullDocument =
        options.full === true ||
        (text.length <= INCREMENTAL_THRESHOLD &&
          options.editLine === undefined);

      if (fullDocument) {
        this.applyBaseFormat(editor, theme);
      }

      if (grammar.length === 0 || text.length === 0) {
        return;
      }

      if (fullDocument && text.length <= LARGE_FILE_CHARS) {
        const tokens = coalesceTokens(tokenize(text, grammar));
        this.applyTokens(editor, theme, tokens, 0, text.length);
        return;
      }

      const range = computeHighlightRange(editor, theme, options.editLine);
      if (range.endChar <= range.startChar) {
        return;
      }

      const slice = text.slice(range.startChar, range.endChar);
      const localTokens = coalesceTokens(tokenize(slice, grammar));
      const tokens = offsetTokens(localTokens, range.startChar);
      this.applyTokens(editor, theme, tokens, range.startChar, range.endChar);
    } finally {
      this.applying = false;
    }
  }

  editLineFromEditor(editor: Editor): number {
    const pos = editor.getCursorPosition();
    return Number(
      User32.SendMessageW(editor.hwnd, EM_LINEFROMCHAR, BigInt(pos), 0n),
    );
  }

  private resolveLanguage(
    path: string | null,
    mode: LanguageMode,
    text: string,
  ): LanguageId {
    if (mode !== "auto") {
      return mode;
    }
    return detectLanguageWithContent(path, text);
  }

  private applyBaseFormat(editor: Editor, theme: ThemeDefinition): void {
    const { buf, retain } = packThemeEditorFormat(theme);
    this.retain.push(buf, ...retain);
    setCharFormatAll(editor.hwnd, buf);
  }

  private applyForegroundRange(
    editor: Editor,
    theme: ThemeDefinition,
    start: number,
    end: number,
  ): void {
    if (end <= start) {
      return;
    }

    const buf = packTextColorFormat(hexToColorRef(theme.editor.foreground));
    this.retain.push(buf);
    const hwnd = editor.hwnd;

    User32.SendMessageW(hwnd, EM_SETSEL, BigInt(start), BigInt(end));
    setCharFormatSelection(hwnd, buf);
  }

  private applyTokens(
    editor: Editor,
    theme: ThemeDefinition,
    tokens: HighlightToken[],
    rangeStart: number,
    rangeEnd: number,
  ): void {
    const hwnd = editor.hwnd;
    const startBuf = Buffer.alloc(4);
    const endBuf = Buffer.alloc(4);
    User32.SendMessageW(
      hwnd,
      EM_GETSEL,
      pointerToBigInt(startBuf),
      pointerToBigInt(endBuf),
    );
    const savedStart = startBuf.readInt32LE(0);
    const savedEnd = endBuf.readInt32LE(0);

    this.applyForegroundRange(editor, theme, rangeStart, rangeEnd);

    const colors = tokenColorsFor(theme);

    for (const token of tokens) {
      if (token.end <= token.start) {
        continue;
      }

      const colorRef = colorForKind(token.kind, colors);
      const format = packTextColorFormat(colorRef);
      this.retain.push(format);

      User32.SendMessageW(
        hwnd,
        EM_SETSEL,
        BigInt(token.start),
        BigInt(token.end),
      );
      setCharFormatSelection(hwnd, format);
    }

    User32.SendMessageW(hwnd, EM_SETSEL, BigInt(savedStart), BigInt(savedEnd));

    if (this.retain.length > 512) {
      this.retain.splice(0, this.retain.length - 128);
    }
  }

  /** Restore syntax colors for a character range after transient bracket highlight. */
  restoreRangeFormat(
    editor: Editor,
    theme: ThemeDefinition,
    start: number,
    end: number,
    text: string,
  ): void {
    if (end <= start || text.length === 0) {
      return;
    }

    if (this.languageMode === "auto") {
      this.language = detectLanguageWithContent(this.documentPath, text);
    }

    const grammar = grammarFor(this.language);
    const hwnd = editor.hwnd;
    const startBuf = Buffer.alloc(4);
    const endBuf = Buffer.alloc(4);
    User32.SendMessageW(
      hwnd,
      EM_GETSEL,
      pointerToBigInt(startBuf),
      pointerToBigInt(endBuf),
    );
    const savedStart = startBuf.readInt32LE(0);
    const savedEnd = endBuf.readInt32LE(0);

    const colors = tokenColorsFor(theme);
    const baseFormat = packTextColorFormat(
      hexToColorRef(theme.editor.foreground),
    );
    this.retain.push(baseFormat);

    const tokens =
      grammar.length > 0 ? coalesceTokens(tokenize(text, grammar)) : [];

    for (let index = start; index < end; index += 1) {
      const token = tokens.find(
        (entry) => index >= entry.start && index < entry.end,
      );
      const format = token
        ? packTextColorFormat(colorForKind(token.kind, colors))
        : baseFormat;
      this.retain.push(format);
      User32.SendMessageW(hwnd, EM_SETSEL, BigInt(index), BigInt(index + 1));
      setCharFormatSelection(hwnd, format);
    }

    User32.SendMessageW(hwnd, EM_SETSEL, BigInt(savedStart), BigInt(savedEnd));
  }
}
