/**
 * Syntax highlighting tokenizer tests (no UI).
 * Run: bun run test:highlight
 */
import {
  detectLanguage,
  detectLanguageFromContent,
} from "../src/highlight/detect";
import { grammarFor } from "../src/highlight/languages";
import {
  getLineCount,
  getLineEnd,
  getLineStart,
  offsetTokens,
} from "../src/highlight/ranges";
import { mapScopeToTokenKind } from "../src/highlight/textmate";
import { coalesceTokens, tokenize } from "../src/highlight/tokenize";

if (detectLanguage("sample.ts") !== "typescript") {
  throw new Error("Expected TypeScript for .ts");
}

if (detectLanguage("data.json") !== "json") {
  throw new Error("Expected JSON for .json");
}

const tsSample = "import { x } from 'y';\nexport const n = 1;";
if (detectLanguageFromContent(tsSample) !== "typescript") {
  throw new Error("Expected TypeScript from content sniff");
}

if (detectLanguage("bunpad.exe") !== "plain") {
  throw new Error("Expected plain for extensionless path");
}

const jsonText = '{"name": "BunPad", "count": 42, "ok": true}';
const jsonTokens = coalesceTokens(tokenize(jsonText, grammarFor("json")));
const jsonKinds = jsonTokens.map((token) => token.kind);

if (!jsonKinds.includes("string") || !jsonKinds.includes("number")) {
  throw new Error(`JSON tokens missing expected kinds: ${jsonKinds.join(",")}`);
}

const tsText = "const count = 1; // comment\n/** block */";
const tsTokens = coalesceTokens(tokenize(tsText, grammarFor("typescript")));
const tsKinds = new Set(tsTokens.map((token) => token.kind));

if (
  !tsKinds.has("keyword") ||
  !tsKinds.has("comment") ||
  !tsKinds.has("number")
) {
  throw new Error(
    `TS tokens missing expected kinds: ${[...tsKinds].join(",")}`,
  );
}

const offset = offsetTokens([{ kind: "keyword", start: 0, end: 3 }], 10);
if (offset[0]?.start !== 10 || offset[0]?.end !== 13) {
  throw new Error("offsetTokens did not shift spans");
}

if (mapScopeToTokenKind("source.ts keyword.control") !== "keyword") {
  throw new Error("TextMate scope map failed for keyword");
}

if (mapScopeToTokenKind("source.json string.quoted") !== "string") {
  throw new Error("TextMate scope map failed for string suffix");
}

if (mapScopeToTokenKind("unknown.scope") !== null) {
  throw new Error("TextMate scope map should return null for unknown scopes");
}

/** Range helpers use Win32 — only validate exports compile when editor is absent. */
if (typeof getLineCount !== "function" || typeof getLineStart !== "function") {
  throw new Error("Range helpers were not exported");
}

if (typeof getLineEnd !== "function") {
  throw new Error("getLineEnd was not exported");
}

console.log("highlight-test ok");
