import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { SettingsStore } from "../app/settings";
import type { ThemeDefinition, ThemeSummary } from "./types";
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
    private readonly settings: SettingsStore,
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
    this.applyStoredTheme();
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
    await this.settings.setTheme(id);
    return this.active;
  }

  userThemesFolder(): string {
    return this.userDir;
  }

  private applyStoredTheme(): void {
    if (this.themes.has(this.settings.theme)) {
      this.activeId = this.settings.theme;
    }
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
}
