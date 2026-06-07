/**
 * Plugin host unit test (no Win32 window).
 * Run: bun run scripts/plugin-test.ts
 */
import { join } from "node:path";

import { Editor } from "../src/app/editor";
import { Document } from "../src/app/document";
import { EditorContextImpl } from "../src/plugins/context";
import { PluginHost } from "../src/plugins/host";

const host = new PluginHost(join(process.cwd(), "plugins"));
const count = await host.loadAll();

if (count < 2) {
  throw new Error(`Expected at least 2 plugins, got ${count}`);
}

const doc = new Document();
const editorStub = {
  _text: "line one  \nline two\t\n",
  getText() {
    return this._text;
  },
  setText(text: string) {
    this._text = text;
  },
  getCursorPosition() {
    return 0;
  },
  selectAll() {},
} as Editor;

const ctx = new EditorContextImpl(editorStub, doc, () => {});
const trimmed = await host.runBeforeSave(ctx, editorStub.getText());

if (trimmed !== "line one\nline two\n") {
  throw new Error(`trim-trailing failed: ${JSON.stringify(trimmed)}`);
}

console.log("plugin-test ok");
