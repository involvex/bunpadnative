const UTF8_BOM = "\uFEFF";

/** Normalize line endings for dirty comparison (RichEdit uses CRLF). */
export const normalizeEditorText = (text: string): string =>
  text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

/** In-memory document metadata for open/save flows. */
export class Document {
  path: string | null = null;
  dirty = false;
  /** True when the file was loaded with a UTF-8 BOM (preserved on save). */
  utf8Bom = false;
  private baselineText = "";

  markClean(): void {
    this.dirty = false;
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Record saved/on-disk text; editor matching this baseline is not dirty. */
  setBaseline(text: string): void {
    this.baselineText = text;
    this.dirty = false;
  }

  /** Recompute dirty from live editor text (handles deferred EN_CHANGE). */
  syncDirtyFromText(text: string): void {
    this.dirty =
      normalizeEditorText(text) !== normalizeEditorText(this.baselineText);
  }

  reset(): void {
    this.path = null;
    this.utf8Bom = false;
    this.setBaseline("");
  }

  async readFromDisk(filePath: string): Promise<string> {
    const bytes = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    let text: string;

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      this.utf8Bom = true;
      text = new TextDecoder("utf-8").decode(bytes.slice(3));
    } else {
      this.utf8Bom = false;
      text = new TextDecoder("utf-8").decode(bytes);
    }

    this.path = filePath;
    return text;
  }

  async writeToDisk(filePath: string, text: string): Promise<void> {
    const payload = this.utf8Bom ? UTF8_BOM + text : text;
    await Bun.write(filePath, payload);
    this.path = filePath;
    this.setBaseline(text);
  }

  displayName(): string {
    if (!this.path) {
      return "Untitled";
    }

    const parts = this.path.split(/[/\\]/);
    return parts[parts.length - 1] ?? this.path;
  }
}
