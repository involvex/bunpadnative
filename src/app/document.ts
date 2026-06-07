const UTF8_BOM = "\uFEFF";

/** In-memory document metadata for open/save flows. */
export class Document {
  path: string | null = null;
  dirty = false;
  /** True when the file was loaded with a UTF-8 BOM (preserved on save). */
  utf8Bom = false;

  markClean(): void {
    this.dirty = false;
  }

  markDirty(): void {
    this.dirty = true;
  }

  reset(): void {
    this.path = null;
    this.dirty = false;
    this.utf8Bom = false;
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
    this.dirty = false;
    return text;
  }

  async writeToDisk(filePath: string, text: string): Promise<void> {
    const payload = this.utf8Bom ? UTF8_BOM + text : text;
    await Bun.write(filePath, payload);
    this.path = filePath;
    this.dirty = false;
  }

  displayName(): string {
    if (!this.path) {
      return "Untitled";
    }

    const parts = this.path.split(/[/\\]/);
    return parts[parts.length - 1] ?? this.path;
  }
}
