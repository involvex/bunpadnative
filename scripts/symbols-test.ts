/**
 * Symbol breadcrumb chain tests.
 * Run: bun run test:symbols
 */
import { symbolChainAtCursor } from "../src/editor/symbols";

const sample = `class MainWindow {
  private applyBracketHighlight(): void {
    const match = findMatchingBracket(text, cursor);
  }
}
`;

const cursor = sample.indexOf("const match");
const chain = symbolChainAtCursor(sample, cursor, "typescript");
const names = chain.map((entry) => entry.name).join(" > ");

if (!names.includes("MainWindow")) {
  throw new Error(`Expected MainWindow in chain, got: ${names}`);
}
if (!names.includes("applyBracketHighlight")) {
  throw new Error(`Expected applyBracketHighlight in chain, got: ${names}`);
}

if (symbolChainAtCursor("plain text", 3, "plain").length !== 0) {
  throw new Error("Expected no symbols for plain language");
}

console.log("symbols-test ok");
