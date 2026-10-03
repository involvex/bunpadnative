import { Document, normalizeEditorText } from "./document";

/** Single editor tab — owns its Document plus cached editor text. */
export type EditorTab = {
  id: number;
  document: Document;
  /** Last known editor text for this tab (live text when active). */
  text: string;
  /** Saved cursor offset for restore on switch. */
  cursor: number;
};

const displayNameFor = (path: string | null, untitledIndex: number): string => {
  if (!path) {
    return untitledIndex <= 1 ? "Untitled" : `Untitled-${untitledIndex}`;
  }
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
};

/** Multi-tab model — pure TS, no HWND. Single editor swaps text on switch. */
export class TabManager {
  private tabs: EditorTab[] = [];
  private nextId = 1;
  private untitledCount = 0;
  private active = 0;

  constructor() {
    this.untitledCount = 1;
    this.tabs.push({
      id: this.nextId++,
      document: new Document(),
      text: "",
      cursor: 0,
    });
  }

  get count(): number {
    return this.tabs.length;
  }

  get activeIndex(): number {
    return this.active;
  }

  get activeTab(): EditorTab {
    return this.tabs[this.active]!;
  }

  get activeDocument(): Document {
    return this.activeTab.document;
  }

  tabAt(index: number): EditorTab | null {
    return this.tabs[index] ?? null;
  }

  labels(): { label: string; dirty: boolean }[] {
    const untitledSeen = new Map<number, number>();
    return this.tabs.map((tab) => {
      let label: string;
      if (!tab.document.path) {
        const seen = (untitledSeen.get(tab.id) ?? 0) + 1;
        untitledSeen.set(tab.id, seen);
        const order = this.tabs
          .filter((t) => !t.document.path)
          .findIndex((t) => t.id === tab.id);
        label = displayNameFor(null, order + 1);
      } else {
        label = displayNameFor(tab.document.path, 0);
      }
      return { label, dirty: tab.document.dirty };
    });
  }

  /** Snapshot live editor text/cursor into the active tab before switching. */
  snapshotActive(text: string, cursor: number): void {
    const tab = this.tabs[this.active];
    if (!tab) {
      return;
    }
    tab.text = text;
    tab.cursor = cursor;
    tab.document.syncDirtyFromText(text);
  }

  /** Update dirty from live EN_CHANGE text. */
  updateActiveText(text: string): void {
    const tab = this.tabs[this.active];
    if (!tab) {
      return;
    }
    tab.text = text;
    tab.document.syncDirtyFromText(text);
  }

  newUntitled(): number {
    this.untitledCount += 1;
    this.tabs.push({
      id: this.nextId++,
      document: new Document(),
      text: "",
      cursor: 0,
    });
    this.active = this.tabs.length - 1;
    return this.active;
  }

  /** Open file text in a new tab, or focus existing tab with same path. */
  openFileText(path: string, text: string, baseline?: string): number {
    const existing = this.tabs.findIndex(
      (t) =>
        t.document.path &&
        normalizeEditorText(t.document.path) === normalizeEditorText(path),
    );
    if (existing >= 0) {
      this.active = existing;
      return existing;
    }
    const document = new Document();
    // readFromDisk sets path; emulate without disk I/O (caller already read).
    document.path = path;
    document.setBaseline(baseline ?? text);
    // If text differs from baseline (CRLF normalization), mark via sync.
    document.syncDirtyFromText(text);
    this.tabs.push({ id: this.nextId++, document, text, cursor: 0 });
    this.active = this.tabs.length - 1;
    return this.active;
  }

  /** Register a path on the active (empty untitled) tab instead of new tab. */
  adoptFileText(path: string, text: string): void {
    const tab = this.tabs[this.active];
    if (!tab) {
      return;
    }
    tab.document.path = path;
    tab.document.setBaseline(text);
    tab.document.syncDirtyFromText(text);
    tab.text = text;
    tab.cursor = 0;
  }

  /** True when the active tab is a pristine untitled tab (reuse for Open). */
  canAdoptForOpen(): boolean {
    const tab = this.tabs[this.active];
    if (!tab || tab.document.path || tab.document.dirty || tab.text !== "") {
      return false;
    }
    return true;
  }

  setActive(index: number): boolean {
    if (index < 0 || index >= this.tabs.length) {
      return false;
    }
    this.active = index;
    return true;
  }

  next(): number {
    if (this.tabs.length === 0) {
      return -1;
    }
    this.active = (this.active + 1) % this.tabs.length;
    return this.active;
  }

  previous(): number {
    if (this.tabs.length === 0) {
      return -1;
    }
    this.active = (this.active - 1 + this.tabs.length) % this.tabs.length;
    return this.active;
  }

  /** Remove tab; returns new active index (-1 when last tab closed). */
  closeAt(index: number): number {
    if (index < 0 || index >= this.tabs.length) {
      return this.active;
    }
    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      this.active = -1;
      return -1;
    }
    if (this.active >= this.tabs.length) {
      this.active = this.tabs.length - 1;
    } else if (index < this.active) {
      this.active -= 1;
    } else if (index === this.active) {
      this.active = Math.min(this.active, this.tabs.length - 1);
    }
    return this.active;
  }

  dirtyIndices(): number[] {
    return this.tabs
      .map((tab, index) => ({ tab, index }))
      .filter(({ tab }) => tab.document.dirty)
      .map(({ index }) => index);
  }
}
