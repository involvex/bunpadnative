import type { LanguageId } from "./types";

const EXTENSIONS: Record<string, LanguageId> = {
  ".json": "json",
  ".jsonc": "json",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".mjs": "typescript",
  ".cjs": "typescript",
  ".md": "markdown",
  ".markdown": "markdown",
};

const CONTENT_SAMPLE = 8192;

/** Sniff language from buffer text when the path has no useful extension. */
export const detectLanguageFromContent = (text: string): LanguageId | null => {
  const sample = text.slice(0, CONTENT_SAMPLE);
  if (!sample.trim()) {
    return null;
  }

  if (/^\s*[{[]/.test(sample) && /"[^"]+"\s*:/.test(sample)) {
    return "json";
  }

  if (
    /\b(import|export|interface|type|enum|declare)\b/.test(sample) ||
    /:\s*(string|number|boolean|void|never|unknown)\b/.test(sample)
  ) {
    return "typescript";
  }

  if (/^#{1,6}\s+\S/m.test(sample) || /\[[^\]]+\]\([^)]+\)/.test(sample)) {
    return "markdown";
  }

  return null;
};

/** Infer highlight language from a file path or null for untitled buffers. */
export const detectLanguage = (path: string | null): LanguageId => {
  if (!path) {
    return "plain";
  }

  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) {
    return "plain";
  }

  return EXTENSIONS[lower.slice(dot)] ?? "plain";
};

/** Path-based detect with optional content sniffing for extensionless buffers. */
export const detectLanguageWithContent = (
  path: string | null,
  text: string,
): LanguageId => {
  const fromPath = detectLanguage(path);
  if (fromPath !== "plain") {
    return fromPath;
  }

  return detectLanguageFromContent(text) ?? "plain";
};
