/**
 * VS Code extension compatibility test (no Win32 window).
 * Run: bun run scripts/extension-test.ts
 */
import { join } from "node:path";

import { ExtensionHost } from "../src/extensions/host";
import { vscodeBridge } from "../src/vscode/bridge";
import { Document } from "../src/app/document";
import { Editor } from "../src/app/editor";

class FakeEditor {
  private text = "alpha\nbeta\ngamma";

  hwnd = 0n;

  getText(): string {
    return this.text;
  }

  setText(text: string): void {
    this.text = text;
  }

  getSelection(): { start: number; end: number } {
    return { start: 0, end: this.text.length };
  }

  setSelection(start: number, end: number): void {
    void start;
    void end;
  }

  replaceRange(start: number, end: number, replacement: string): void {
    this.text = this.text.slice(0, start) + replacement + this.text.slice(end);
  }

  getCursorPosition(): number {
    return 0;
  }

  getLineColumn(): { line: number; column: number } {
    return { line: 1, column: 1 };
  }

  selectAll(): void {}
}

const host = new ExtensionHost(join(process.cwd(), "extensions"));
const count = await host.loadAll();

if (count < 1) {
  throw new Error(`Expected at least 1 extension, got ${count}`);
}

const fake = new FakeEditor();
const doc = new Document();
vscodeBridge.bind(fake as unknown as Editor, doc, 0n);
await host.activateStartup();

await host.executeCommand("reverseLines.reverse");

const result = fake.getText();
if (result !== "gamma\nbeta\nalpha") {
  throw new Error(`Reverse lines failed: ${JSON.stringify(result)}`);
}

console.log("extension-test ok");
