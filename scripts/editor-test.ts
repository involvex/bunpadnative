/**
 * Editor find/replace logic tests (no UI).
 * Run: bun run test:editor
 */
import { Editor } from "../src/app/editor";

const editor = {
  text: "alpha beta alpha",
  selStart: 0,
  selEnd: 0,
  getText() {
    return this.text;
  },
  setText(value: string) {
    this.text = value;
  },
  getSelection() {
    return { start: this.selStart, end: this.selEnd };
  },
  setSelection(start: number, end: number) {
    this.selStart = start;
    this.selEnd = end;
  },
  replaceRange(start: number, end: number, replacement: string) {
    this.text = this.text.slice(0, start) + replacement + this.text.slice(end);
    const cursor = start + replacement.length;
    this.setSelection(cursor, cursor);
  },
} as unknown as Editor;

const findNext = Editor.prototype.findNext.bind(editor);
const replaceAll = Editor.prototype.replaceAll.bind(editor);

editor.setText("alpha beta alpha");
editor.setSelection(0, 0);
if (!findNext("beta")) {
  throw new Error("Expected to find beta");
}
if (editor.getSelection().start !== 6) {
  throw new Error("Expected selection at beta");
}

editor.setSelection(11, 11);
if (!findNext("alpha")) {
  throw new Error("Expected wrap-around find for alpha");
}

editor.setText("one two one");
editor.setSelection(0, 0);
const replaced = replaceAll("one", "1");
if (replaced !== 2) {
  throw new Error(`Expected 2 replacements, got ${replaced}`);
}
if (editor.getText() !== "1 two 1") {
  throw new Error(`Unexpected replace-all text: ${editor.getText()}`);
}

console.log("editor-test ok");
