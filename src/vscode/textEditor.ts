import type { Editor } from "../app/editor";
import { positionToOffset } from "./textDocument";
import type { VscodeTextDocument } from "./textDocument";
import { type Position, Range, Selection, type TextEditorEdit } from "./types";

/** VS Code TextEditor backed by the native RichEdit control. */
export class VscodeTextEditor {
  constructor(
    readonly document: VscodeTextDocument,
    private readonly editor: Editor,
  ) {}

  get selection(): Selection {
    const { start, end } = this.editor.getSelection();
    const anchor = this.document.positionAt(start);
    const active = this.document.positionAt(end);
    return new Selection(
      anchor.line,
      anchor.character,
      active.line,
      active.character,
    );
  }

  get selections(): Selection[] {
    return [this.selection];
  }

  async edit(
    callback: (editBuilder: TextEditorEdit) => void | Promise<void>,
  ): Promise<boolean> {
    const edits: Array<{ range: Range; newText: string }> = [];
    const builder: TextEditorEdit = {
      replace: (range, value) => {
        edits.push({ range, newText: value });
      },
      insert: (location, value) => {
        edits.push({ range: new Range(location, location), newText: value });
      },
      delete: (range) => {
        edits.push({ range, newText: "" });
      },
    };

    await callback(builder);
    if (edits.length === 0) {
      return false;
    }

    return this.document.applyEdits(edits);
  }

  insertSnippet(text: string, location?: Position): Promise<boolean> {
    const position = location ?? this.selection.active;
    return this.edit((builder) => {
      builder.insert(position, text);
    });
  }

  revealRange(_range: Range): void {
    const text = this.document.getText();
    const offset = positionToOffset(text, _range.start);
    this.editor.setSelection(offset, offset);
  }
}
