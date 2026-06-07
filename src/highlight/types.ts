/** Semantic token kinds mapped to theme token colors. */
export type TokenKind =
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "type"
  | "function"
  | "operator"
  | "punctuation";

export type LanguageId = "json" | "typescript" | "markdown" | "plain";

/** `auto` follows file extension; otherwise forces a grammar. */
export type LanguageMode = LanguageId | "auto";

export type HighlightToken = {
  kind: TokenKind;
  start: number;
  end: number;
};

export type HighlightRule = {
  kind: TokenKind;
  pattern: RegExp;
};

export type ThemeTokenColors = {
  comment: string;
  string: string;
  keyword: string;
  number: string;
  type: string;
  function: string;
  operator: string;
  punctuation: string;
};
