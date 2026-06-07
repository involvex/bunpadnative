import type { TokenKind } from "../types";

/** Minimal TextMate scope → BunPad token kind mapping for future grammar import. */
const SCOPE_SUFFIXES: Array<{ suffix: string; kind: TokenKind }> = [
  { suffix: "constant.numeric", kind: "number" },
  { suffix: "entity.name.type", kind: "type" },
  { suffix: "entity.name.class", kind: "type" },
  { suffix: "entity.name.function", kind: "function" },
  { suffix: "support.function", kind: "function" },
  { suffix: "keyword.operator", kind: "operator" },
  { suffix: "comment", kind: "comment" },
  { suffix: "string", kind: "string" },
  { suffix: "keyword", kind: "keyword" },
  { suffix: "punctuation", kind: "punctuation" },
];

const scopeMatches = (scope: string, suffix: string): boolean => {
  if (scope === suffix) {
    return true;
  }

  if (suffix.includes(".")) {
    return scope.includes(suffix);
  }

  return scope.split(/[\s.]+/).includes(suffix);
};

/**
 * Map a TextMate scope string (e.g. `source.ts keyword.control`) to a token kind.
 * Returns null when no mapping matches — caller should fall back to plain text.
 */
export const mapScopeToTokenKind = (scope: string): TokenKind | null => {
  const normalized = scope.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const entry of SCOPE_SUFFIXES) {
    if (scopeMatches(normalized, entry.suffix)) {
      return entry.kind;
    }
  }

  return null;
};

/** TextMate grammar JSON shape (subset) for future plist/JSON loaders. */
export type TextMatePattern = {
  name?: string;
  match?: string;
  begin?: string;
  end?: string;
  patterns?: TextMatePattern[];
};

export type TextMateGrammarJson = {
  scopeName: string;
  patterns: TextMatePattern[];
};

/**
 * Placeholder for VS Code `.tmLanguage.json` import — not wired yet.
 * Returns null until a loader compiles TextMate rules into HighlightRule[].
 */
export const loadTextMateGrammar = (
  _sourcePath: string,
): TextMateGrammarJson | null => null;
