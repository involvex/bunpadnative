import type { HighlightRule, LanguageId } from "./types";

const JSON_RULES: HighlightRule[] = [
  { kind: "string", pattern: /"(?:\\.|[^"\\])*"/y },
  { kind: "number", pattern: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y },
  { kind: "keyword", pattern: /\b(?:true|false|null)\b/y },
  { kind: "punctuation", pattern: /[{}[\]:,]/y },
];

const TS_KEYWORDS =
  /\b(?:abstract|as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield|type|declare|readonly|satisfies|keyof|infer|never|unknown|any)\b/y;

const TYPESCRIPT_RULES: HighlightRule[] = [
  { kind: "comment", pattern: /\/\/[^\n]*/y },
  { kind: "comment", pattern: /\/\*[\s\S]*?\*\//y },
  { kind: "string", pattern: /"(?:\\.|[^"\\])*"/y },
  { kind: "string", pattern: /'(?:\\.|[^'\\])*'/y },
  { kind: "string", pattern: /`(?:\\.|[^`\\])*`/y },
  { kind: "number", pattern: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y },
  { kind: "keyword", pattern: TS_KEYWORDS },
  { kind: "type", pattern: /\b[A-Z][A-Za-z0-9_]*\b/y },
  { kind: "function", pattern: /\b[a-zA-Z_$][\w$]*(?=\s*\()/y },
  { kind: "operator", pattern: /[+\-*/%=<>!&|^~?:]+|\.\.\./y },
  { kind: "punctuation", pattern: /[{}[\]();,.]/y },
];

const MARKDOWN_RULES: HighlightRule[] = [
  { kind: "comment", pattern: /<!--[\s\S]*?-->/y },
  { kind: "keyword", pattern: /^#{1,6}\s+.+$/my },
  { kind: "string", pattern: /`[^`\n]+`/y },
  { kind: "string", pattern: /```[\s\S]*?```/y },
  { kind: "keyword", pattern: /\*\*[^*\n]+\*\*|__[^_\n]+__/y },
];

const RULES: Record<LanguageId, HighlightRule[]> = {
  json: JSON_RULES,
  typescript: TYPESCRIPT_RULES,
  markdown: MARKDOWN_RULES,
  plain: [],
};

export const grammarFor = (language: LanguageId): HighlightRule[] =>
  RULES[language] ?? [];

export const languageLabel = (language: LanguageId): string => {
  switch (language) {
    case "json":
      return "JSON";
    case "typescript":
      return "TypeScript";
    case "markdown":
      return "Markdown";
    default:
      return "Plain Text";
  }
};
