import type { Document } from "../app/document";
import type { Editor } from "../app/editor";
import type { EditorContext } from "./types";

/** EditorContext backed by native Editor + Document state. */
export class EditorContextImpl implements EditorContext {
  constructor(
    private readonly editor: Editor,
    private readonly document: Document,
    private readonly toast: (message: string) => void,
  ) {}

  getText(): string {
    return this.editor.getText();
  }

  setText(text: string): void {
    this.editor.setText(text);
  }

  getCursorPosition(): number {
    return this.editor.getCursorPosition();
  }

  getDocumentPath(): string | null {
    return this.document.path;
  }

  isDirty(): boolean {
    return this.document.dirty;
  }

  showToast(message: string): void {
    this.toast(message);
  }
}
