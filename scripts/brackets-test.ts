/**
 * Auto-bracket and bracket matching tests.
 * Run: bun run test:brackets
 */
import {
  autoCloseForChar,
  findMatchingBracket,
  shouldMatchBrackets,
} from "../src/editor/brackets";
import { DEFAULT_EDITOR_SETTINGS } from "../src/theme/types";

const settings = { ...DEFAULT_EDITOR_SETTINGS };

const open = autoCloseForChar("(", settings, false);
if (!open || open.insert !== "()" || open.cursorOffset !== 1) {
  throw new Error("Expected () insertion for open paren");
}

if (autoCloseForChar("(", settings, true)) {
  throw new Error("Expected no auto-close with selection");
}

if (autoCloseForChar("(", { ...settings, autoCloseBrackets: false }, false)) {
  throw new Error("Expected auto-close disabled by setting");
}

const text = "(hello) { return [1]; }";
const fnMatch = findMatchingBracket(text, 0);
if (!fnMatch || text[fnMatch.open] !== "(" || text[fnMatch.close] !== ")") {
  throw new Error("Expected matching parentheses");
}

const arrayMatch = findMatchingBracket(text, text.indexOf("["));
if (
  !arrayMatch ||
  text[arrayMatch.open] !== "[" ||
  text[arrayMatch.close] !== "]"
) {
  throw new Error("Expected matching square brackets");
}

if (!shouldMatchBrackets(settings)) {
  throw new Error("Expected bracket matching enabled by default");
}

console.log("brackets-test ok");
