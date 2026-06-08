/**
 * Buffer word completion candidate tests.
 * Run: bun run test:completion
 */
import {
  buildCompletionCandidates,
  shouldTriggerCompletion,
  wordPrefixAt,
} from "../src/editor/completion";
import { DEFAULT_EDITOR_SETTINGS } from "../src/theme/types";

const text = "function hello() {\n  const world = hello;\n}\n";

const prefix = wordPrefixAt(text, text.indexOf("hello;") + 5);
if (prefix.prefix !== "hello") {
  throw new Error(`Expected prefix "hello", got "${prefix.prefix}"`);
}

const candidates = buildCompletionCandidates(
  text,
  text.indexOf("hello;") + 5,
  "hel",
);
if (!candidates.includes("hello")) {
  throw new Error("Expected hello in completion candidates");
}
if (candidates.includes("hel")) {
  throw new Error("Prefix itself should not appear as candidate");
}

const settings = { ...DEFAULT_EDITOR_SETTINGS, completionMinChars: 3 };
if (!shouldTriggerCompletion(settings, "hel")) {
  throw new Error("Expected completion at min chars");
}
if (shouldTriggerCompletion(settings, "he")) {
  throw new Error("Expected no completion below min chars");
}
if (shouldTriggerCompletion({ ...settings, wordCompletion: false }, "hello")) {
  throw new Error("Expected completion disabled when setting off");
}

console.log("completion-test ok");
