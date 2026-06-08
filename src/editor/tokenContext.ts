import { grammarFor } from "../highlight/languages";
import { coalesceTokens, tokenize } from "../highlight/tokenize";
import type { HighlightToken, LanguageId, TokenKind } from "../highlight/types";

const BRACKET_BLOCKING_KINDS = new Set<TokenKind>(["string", "comment"]);

const isInsideToken = (
  pos: number,
  tokens: readonly HighlightToken[],
  kinds: ReadonlySet<TokenKind>,
): boolean => {
  for (const token of tokens) {
    if (pos >= token.start && pos < token.end && kinds.has(token.kind)) {
      return true;
    }
  }
  return false;
};

/** Tokenize buffer once for bracket/string context checks. */
export const tokenizeForContext = (
  text: string,
  language: LanguageId,
): HighlightToken[] => {
  const grammar = grammarFor(language);
  if (grammar.length === 0 || text.length === 0) {
    return [];
  }
  return coalesceTokens(tokenize(text, grammar));
};

/** True when auto-close / bracket matching should run at this offset. */
export const isBracketContextAllowed = (
  text: string,
  cursor: number,
  language: LanguageId,
  tokens?: readonly HighlightToken[],
): boolean => {
  const resolved = tokens ?? tokenizeForContext(text, language);
  const probe = Math.max(0, Math.min(cursor, text.length - 1));
  if (text.length === 0) {
    return true;
  }
  return !isInsideToken(probe, resolved, BRACKET_BLOCKING_KINDS);
};

/** True when a bracket character at `index` is inside code (not string/comment). */
export const isBracketIndexInCode = (
  index: number,
  tokens: readonly HighlightToken[],
): boolean => !isInsideToken(index, tokens, BRACKET_BLOCKING_KINDS);
