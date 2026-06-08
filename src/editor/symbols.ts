import type { LanguageId } from "../highlight/types";

export type SymbolSegment = {
  name: string;
  line: number;
  charOffset: number;
};

const SKIP_NAMES = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "else",
  "do",
  "try",
  "finally",
]);

const TS_PATTERNS: RegExp[] = [
  /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
  /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
  /^\s*(?:public|private|protected|static|readonly|async|\s)*(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/,
  /^\s*(?:public|private|protected|static|readonly|async|\s)*(\w+)\s*\([^)]*\)\s*\{/,
];

type SymbolFrame = SymbolSegment & { indent: number };

const indentOf = (line: string): number => line.match(/^\s*/)?.[0]?.length ?? 0;

/** Nested symbol breadcrumb chain at the cursor for TypeScript-like buffers. */
export const symbolChainAtCursor = (
  text: string,
  cursor: number,
  language: LanguageId,
): SymbolSegment[] => {
  if (language !== "typescript") {
    return [];
  }

  const cursorLine = text.slice(0, cursor).split("\n").length - 1;
  const lines = text.split("\n");
  const stack: SymbolFrame[] = [];
  let offset = 0;

  for (
    let lineNo = 0;
    lineNo <= cursorLine && lineNo < lines.length;
    lineNo += 1
  ) {
    const line = lines[lineNo]!;
    const indent = indentOf(line);

    for (const pattern of TS_PATTERNS) {
      const match = pattern.exec(line);
      const name = match?.[1];
      if (!name || SKIP_NAMES.has(name)) {
        continue;
      }

      while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
        stack.pop();
      }

      stack.push({
        name,
        indent,
        line: lineNo,
        charOffset: offset + (match.index ?? 0),
      });
      break;
    }

    offset += line.length + 1;
  }

  return stack.map(({ name, line, charOffset }) => ({
    name,
    line,
    charOffset,
  }));
};
