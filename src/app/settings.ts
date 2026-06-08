import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  DEFAULT_EDITOR_SETTINGS,
  type AppSettings,
  type EditorSettings,
} from "../theme/types";
import type { LanguageMode } from "../highlight/types";

const DEFAULT_THEME = "dark";
const DEFAULT_LANGUAGE_MODE: LanguageMode = "auto";

const LANGUAGE_MODES: LanguageMode[] = [
  "auto",
  "plain",
  "json",
  "typescript",
  "markdown",
];

export const MAX_RECENT_FILES = 10;

const mergeEditorSettings = (
  partial?: Partial<EditorSettings>,
): EditorSettings => ({
  ...DEFAULT_EDITOR_SETTINGS,
  ...partial,
});

/** Persists app settings to %APPDATA%/BunPad/settings.json. */
export class SettingsStore {
  private data: AppSettings = {
    theme: DEFAULT_THEME,
    recentFiles: [],
    languageMode: DEFAULT_LANGUAGE_MODE,
    editor: { ...DEFAULT_EDITOR_SETTINGS },
  };

  constructor(readonly path: string) {}

  get theme(): string {
    return this.data.theme;
  }

  get recentFiles(): readonly string[] {
    return this.data.recentFiles;
  }

  get languageMode(): LanguageMode {
    return this.data.languageMode ?? DEFAULT_LANGUAGE_MODE;
  }

  get editor(): EditorSettings {
    return mergeEditorSettings(this.data.editor);
  }

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(this.path, "utf8"),
      ) as Partial<AppSettings>;
      if (typeof raw.theme === "string") {
        this.data.theme = raw.theme;
      }
      if (Array.isArray(raw.recentFiles)) {
        this.data.recentFiles = raw.recentFiles
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, MAX_RECENT_FILES);
      }
      if (
        typeof raw.languageMode === "string" &&
        LANGUAGE_MODES.includes(raw.languageMode as LanguageMode)
      ) {
        this.data.languageMode = raw.languageMode as LanguageMode;
      }
      if (raw.editor && typeof raw.editor === "object") {
        this.data.editor = mergeEditorSettings(
          raw.editor as Partial<EditorSettings>,
        );
      }
    } catch {
      // First run — keep defaults.
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(this.data, null, 2)}\n`);
  }

  async setTheme(id: string): Promise<void> {
    this.data.theme = id;
    await this.save();
  }

  async addRecentFile(filePath: string): Promise<void> {
    this.data.recentFiles = [
      filePath,
      ...this.data.recentFiles.filter((entry) => entry !== filePath),
    ].slice(0, MAX_RECENT_FILES);
    await this.save();
  }

  async clearRecentFiles(): Promise<void> {
    this.data.recentFiles = [];
    await this.save();
  }

  async setLanguageMode(mode: LanguageMode): Promise<void> {
    this.data.languageMode = mode;
    await this.save();
  }

  async setEditorSettings(settings: EditorSettings): Promise<void> {
    this.data.editor = { ...settings };
    await this.save();
  }
}
