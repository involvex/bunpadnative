import type { Document } from "../app/document";
import type { Editor } from "../app/editor";
import { EventEmitter } from "./events";
import { createTextDocument, type VscodeTextDocument } from "./textDocument";
import { VscodeTextEditor } from "./textEditor";
import { workspaceFs } from "./workspace";

/** Connects the vscode shim to the live native editor instance. */
export class VscodeBridge {
  private editor: Editor | null = null;
  private document: Document | null = null;
  private vscodeDocument: VscodeTextDocument | null = null;
  private vscodeEditor: VscodeTextEditor | null = null;

  messageParent = 0n;

  readonly onDidChangeTextDocument = new EventEmitter<{
    document: VscodeTextDocument;
  }>();

  bind(
    editor: Editor,
    document: Document,
    messageParent: bigint,
    onAfterWrite?: () => void,
  ): void {
    this.editor = editor;
    this.document = document;
    this.messageParent = messageParent;
    this.vscodeDocument = createTextDocument(document, editor, onAfterWrite);
    this.vscodeEditor = new VscodeTextEditor(this.vscodeDocument, editor);
  }

  clear(): void {
    this.editor = null;
    this.document = null;
    this.vscodeDocument = null;
    this.vscodeEditor = null;
  }

  getActiveTextEditor(): VscodeTextEditor | undefined {
    return this.vscodeEditor ?? undefined;
  }

  getActiveTextDocument(): VscodeTextDocument | undefined {
    return this.vscodeDocument ?? undefined;
  }

  notifyDocumentChanged(): void {
    if (!this.vscodeDocument) {
      return;
    }

    this.vscodeDocument.bumpVersion();
    this.onDidChangeTextDocument.fire({ document: this.vscodeDocument });
  }

  get workspace() {
    const bridge = this;
    return {
      fs: workspaceFs,
      get textDocuments() {
        const doc = bridge.getActiveTextDocument();
        return doc ? [doc] : [];
      },
      onDidChangeTextDocument: bridge.onDidChangeTextDocument.event,
      get workspaceFolders() {
        return undefined;
      },
    };
  }
}

export const vscodeBridge = new VscodeBridge();
