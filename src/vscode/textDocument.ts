import type { Document } from "../app/document";
import type { Editor } from "../app/editor";
import { EndOfLine, Position, Range, Uri } from "./types";

const offsetToPosition = (text: string, offset: number): Position => {
  const normalized = text.replace(/\r\n/g, "\n");
  let line = 0;
  let index = 0;

  while (index < offset && index < normalized.length) {
    const nextBreak = normalized.indexOf("\n", index);
    if (nextBreak === -1 || nextBreak >= offset) {
      break;
    }
    line += 1;
    index = nextBreak + 1;
  }

  return new Position(line, offset - index);
};

export const positionToOffset = (text: string, position: Position): number => {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (position.line >= lines.length) {
    return normalized.length;
  }

  let offset = 0;
  for (let line = 0; line < position.line; line += 1) {
    offset += (lines[line]?.length ?? 0) + 1;
  }

  return offset + position.character;
};

export const rangeToOffsets = (
  text: string,
  range: Range,
): { start: number; end: number } => ({
  start: positionToOffset(text, range.start),
  end: positionToOffset(text, range.end),
});

/** VS Code TextDocument backed by the native editor buffer. */
export class VscodeTextDocument {
  private version = 0;

  constructor(
    readonly uri: Uri,
    private readonly readText: () => string,
    private readonly writeText: (text: string) => void,
    private readonly pathProvider: () => string | null,
  ) {}

  get fileName(): string {
    const path = this.pathProvider() ?? this.uri.fsPath;
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] ?? "Untitled";
  }

  get languageId(): string {
    const name = this.fileName.toLowerCase();
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      return "typescript";
    }
    if (name.endsWith(".js") || name.endsWith(".jsx")) {
      return "javascript";
    }
    if (name.endsWith(".json")) {
      return "json";
    }
    if (name.endsWith(".md")) {
      return "markdown";
    }
    return "plaintext";
  }

  get lineCount(): number {
    const text = this.getText();
    if (!text) {
      return 1;
    }
    return text.split(/\r?\n/).length;
  }

  get isDirty(): boolean {
    return false;
  }

  get isUntitled(): boolean {
    return !this.pathProvider();
  }

  get eol(): EndOfLine {
    return this.getText().includes("\r\n") ? EndOfLine.CRLF : EndOfLine.LF;
  }

  bumpVersion(): void {
    this.version += 1;
  }

  getVersion(): number {
    return this.version;
  }

  getText(range?: Range): string {
    const text = this.readText();
    if (!range) {
      return text;
    }

    const { start, end } = rangeToOffsets(text, range);
    return text.slice(start, end);
  }

  lineAt(line: number): { text: string; range: Range; lineNumber: number } {
    const lines = this.getText().split(/\r?\n/);
    const clamped = Math.max(0, Math.min(line, lines.length - 1));
    const text = lines[clamped] ?? "";
    return {
      text,
      lineNumber: clamped,
      range: new Range(clamped, 0, clamped, text.length),
    };
  }

  offsetAt(position: Position): number {
    return positionToOffset(this.getText(), position);
  }

  positionAt(offset: number): Position {
    return offsetToPosition(this.getText(), offset);
  }

  applyEdits(
    edits: Array<{ range: Range; newText: string }>,
  ): boolean {
    let text = this.getText();
    const sorted = [...edits].sort(
      (a, b) => rangeToOffsets(text, b.range).start - rangeToOffsets(text, a.range).start,
    );

    for (const edit of sorted) {
      const { start, end } = rangeToOffsets(text, edit.range);
      text = text.slice(0, start) + edit.newText + text.slice(end);
    }

    this.writeText(text);
    this.bumpVersion();
    return true;
  }
}

export const createTextDocument = (
  document: Document,
  editor: Editor,
): VscodeTextDocument => {
  const uri = Uri.file(document.path ?? "untitled:Untitled-1");
  return new VscodeTextDocument(
    uri,
    () => editor.getText(),
    (text) => editor.setText(text),
    () => document.path,
  );
};
