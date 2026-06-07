import type { Editor } from "../app/editor";
import {
  applyTheme,
  createThemeResources,
  destroyThemeResources,
  type ThemeResources,
} from "./apply";
import type { ThemeManager } from "./manager";
import type { ThemeDefinition } from "./types";

export { ThemeManager } from "./manager";
export type { ThemeDefinition, ThemeSummary } from "./types";
export { applyTheme, createThemeResources, destroyThemeResources };
export type { ThemeResources };

export type ThemeChangeListener = (theme: ThemeDefinition) => void;

/** Facade used by MainWindow for theme apply + persistence. */
export class ThemeController {
  private resources: ThemeResources | null = null;
  private listeners: ThemeChangeListener[] = [];

  constructor(readonly manager: ThemeManager) {}

  current(): ThemeDefinition {
    return this.manager.active;
  }

  onChange(listener: ThemeChangeListener): void {
    this.listeners.push(listener);
  }

  async selectTheme(id: string): Promise<ThemeDefinition> {
    const theme = await this.manager.setTheme(id);
    this.notify(theme);
    return theme;
  }

  async reload(): Promise<number> {
    const count = await this.manager.reload();
    this.notify(this.manager.active);
    return count;
  }

  applyToWindow(hwnd: bigint, editor: Editor, useRichEdit: boolean): void {
    if (this.resources) {
      destroyThemeResources(this.resources);
    }

    const theme = this.manager.active;
    this.resources = createThemeResources(theme);
    applyTheme(hwnd, editor, theme, useRichEdit, this.resources);
  }

  getEditBrush(): bigint {
    return this.resources?.editBrush ?? 0n;
  }

  destroy(): void {
    if (this.resources) {
      destroyThemeResources(this.resources);
      this.resources = null;
    }
  }

  private notify(theme: ThemeDefinition): void {
    for (const listener of this.listeners) {
      listener(theme);
    }
  }
}
