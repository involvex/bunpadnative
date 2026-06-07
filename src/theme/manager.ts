import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AppSettings, ThemeDefinition, ThemeSummary } from "./types";
import { parseTheme } from "./validate";

const THEME_EXT = /\.json$/i;
const DEFAULT_THEME_ID = "dark";

/** Loads built-in and user themes; persists active theme selection. */
export class ThemeManager {
  private themes = new Map<string, ThemeDefinition>();
  private activeId = DEFAULT_THEME_ID;
  private commandMap = new Map<number, string>();

  constructor(
    readonly builtinDir: string,
    readonly userDir: string,
    readonly settingsPath: string,
  ) {}

  get active(): ThemeDefinition {
    return (
      this.themes.get(this.activeId) ??
      this.themes.get(DEFAULT_THEME_ID) ??
      [...this.themes.values()][0]!
    );
  }

  get summaries(): ThemeSummary[] {
    return [...this.themes.values()]
      .map((theme) => ({ id: theme.id, name: theme.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  themeIdForCommand(commandId: number): string | null {
    return this.commandMap.get(commandId) ?? null;
  }

  async init(): Promise<void> {
    await mkdir(this.userDir, { recursive: true });
    await this.loadDirectory(this.builtinDir);
    await this.loadDirectory(this.userDir);
    await this.loadSettings();
    this.rebuildCommandMap();
  }

  async reload(): Promise<number> {
    this.themes.clear();
    await this.loadDirectory(this.builtinDir);
    await this.loadDirectory(this.userDir);
    this.rebuildCommandMap();
    return this.themes.size;
  }

  async setTheme(id: string): Promise<ThemeDefinition> {
    if (!this.themes.has(id)) {
      throw new Error(`Unknown theme: ${id}`);
    }

    this.activeId = id;
    await this.saveSettings();
    return this.active;
  }

  userThemesFolder(): string {
    return this.userDir;
  }

  private rebuildCommandMap(): void {
    this.commandMap.clear();
    let command = 1300;
    for (const summary of this.summaries) {
      if (command > 1397) {
        break;
      }
      this.commandMap.set(command, summary.id);
      command += 1;
    }
  }

  private async loadDirectory(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }

    for (const file of entries.filter((name) => THEME_EXT.test(name))) {
      const fullPath = join(dir, file);
      try {
        const raw = JSON.parse(await readFile(fullPath, "utf8"));
        const theme = parseTheme(raw, fullPath);
        this.themes.set(theme.id, theme);
      } catch (error) {
        console.warn(`[themes] skipping ${file}:`, error);
      }
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(this.settingsPath, "utf8"),
      ) as AppSettings;
      if (typeof raw.theme === "string" && this.themes.has(raw.theme)) {
        this.activeId = raw.theme;
      }
    } catch {
      // First run — keep default.
    }
  }

  private async saveSettings(): Promise<void> {
    await mkdir(dirname(this.settingsPath), { recursive: true });
    const settings: AppSettings = { theme: this.activeId };
    await writeFile(
      this.settingsPath,
      `${JSON.stringify(settings, null, 2)}\n`,
    );
  }
}
