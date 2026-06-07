import type { HighlightRule, HighlightToken } from "./types";

/** Greedy regex tokenizer — first matching rule at cursor wins. */
export const tokenize = (
  text: string,
  rules: HighlightRule[],
): HighlightToken[] => {
  const tokens: HighlightToken[] = [];
  let pos = 0;

  while (pos < text.length) {
    let matched = false;

    for (const rule of rules) {
      rule.pattern.lastIndex = pos;
      const match = rule.pattern.exec(text);
      if (match && match.index === pos && match[0].length > 0) {
        tokens.push({
          kind: rule.kind,
          start: pos,
          end: pos + match[0].length,
        });
        pos += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      pos += 1;
    }
  }

  return tokens;
};

/** Merge adjacent tokens with the same kind to reduce format passes. */
export const coalesceTokens = (tokens: HighlightToken[]): HighlightToken[] => {
  if (tokens.length === 0) {
    return tokens;
  }

  const merged: HighlightToken[] = [{ ...tokens[0]! }];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const last = merged[merged.length - 1]!;
    if (token.kind === last.kind && token.start === last.end) {
      last.end = token.end;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
};
