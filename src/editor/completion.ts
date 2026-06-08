import type { EditorSettings } from "../theme/types";

const WORD_PATTERN = /\b[A-Za-z_]\w*\b/g;

export type WordPrefix = {
  start: number;
  prefix: string;
};

/** Word prefix immediately before the cursor. */
export const wordPrefixAt = (text: string, cursor: number): WordPrefix => {
  let start = cursor;
  while (start > 0 && /[\w]/.test(text[start - 1]!)) {
    start -= 1;
  }
  return { start, prefix: text.slice(start, cursor) };
};

/** Unique buffer words matching prefix (case-insensitive), excluding exact prefix. */
export const buildCompletionCandidates = (
  text: string,
  cursor: number,
  prefix: string,
): string[] => {
  if (!prefix) {
    return [];
  }

  const lowerPrefix = prefix.toLowerCase();
  const words = new Set<string>();

  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0]!;
    if (word.toLowerCase().startsWith(lowerPrefix) && word !== prefix) {
      words.add(word);
    }
  }

  const { start } = wordPrefixAt(text, cursor);
  const currentWord = text.slice(start, cursor);
  if (currentWord.toLowerCase() === lowerPrefix && currentWord.length > 0) {
    words.delete(currentWord);
  }

  return [...words].sort((a, b) => a.localeCompare(b)).slice(0, 50);
};

export const shouldTriggerCompletion = (
  settings: EditorSettings,
  prefix: string,
): boolean =>
  settings.wordCompletion && prefix.length >= settings.completionMinChars;
