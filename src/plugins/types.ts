/** Safe editor surface exposed to dynamically loaded plugins. */
export type EditorContext = {
  getText(): string;
  setText(text: string): void;
  getCursorPosition(): number;
  getDocumentPath(): string | null;
  isDirty(): boolean;
  showToast(message: string): void;
};

/** Lifecycle hooks plugins may export. */
export type PluginHooks = {
  onEditorReady?(ctx: EditorContext): void | Promise<void>;
  onBeforeSave?(ctx: EditorContext): string | void | Promise<string | void>;
  onTextChange?(ctx: EditorContext): void | Promise<void>;
};

/** Default export shape for files in plugins/. */
export type BunPadPlugin = PluginHooks & {
  name?: string;
  activate?(ctx: EditorContext): void | Promise<void>;
};

export type LoadedPlugin = {
  id: string;
  path: string;
  plugin: BunPadPlugin;
};
