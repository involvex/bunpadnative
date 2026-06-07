/** In-memory document metadata for open/save flows. */
export class Document {
  path: string | null = null;
  dirty = false;

  markClean(): void {
    this.dirty = false;
  }

  markDirty(): void {
    this.dirty = true;
  }

  reset(): void {
    this.path = null;
    this.dirty = false;
  }

  async readFromDisk(filePath: string): Promise<string> {
    const text = await Bun.file(filePath).text();
    this.path = filePath;
    this.dirty = false;
    return text;
  }

  async writeToDisk(filePath: string, text: string): Promise<void> {
    await Bun.write(filePath, text);
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
