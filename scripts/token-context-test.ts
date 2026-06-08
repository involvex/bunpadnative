/**
 * Bracket token-context tests.
 * Run: bun run test:token-context
 */
import { autoCloseForChar, findMatchingBracket } from "../src/editor/brackets";
import { isBracketContextAllowed } from "../src/editor/tokenContext";
import { DEFAULT_EDITOR_SETTINGS } from "../src/theme/types";

const settings = { ...DEFAULT_EDITOR_SETTINGS };
const tsLine = 'const msg = "(not a bracket)"; function real() { return 1; }';

if (isBracketContextAllowed(tsLine, tsLine.indexOf("("), "typescript")) {
  throw new Error("Expected paren inside string literal to be blocked");
}

const fnOpen = tsLine.indexOf("real(") + 4;
if (!isBracketContextAllowed(tsLine, fnOpen, "typescript")) {
  throw new Error("Expected real function paren to allow bracket context");
}

if (findMatchingBracket(tsLine, fnOpen, "typescript") === null) {
  throw new Error("Expected matching paren for real()");
}

const quoted = 'const x = "(inside)";';
const parenInString = quoted.indexOf("(");
const inString = autoCloseForChar("(", settings, false, {
  text: quoted,
  cursor: parenInString,
  language: "typescript",
});
if (inString) {
  throw new Error("Expected no auto-close inside string literal");
}
if (isBracketContextAllowed(quoted, parenInString, "typescript")) {
  throw new Error("Expected bracket context blocked inside string");
}

console.log("token-context-test ok");
