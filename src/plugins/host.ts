import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { EditorContextImpl } from "./context";
import type { BunPadPlugin, LoadedPlugin } from "./types";

const PLUGIN_EXT = /\.(?:ts|js|mts|mjs)$/i;

/** Scans plugins/, dynamic-imports modules, dispatches lifecycle hooks. */
export class PluginHost {
  private loaded: LoadedPlugin[] = [];
  private textChangeScheduled = false;

  constructor(readonly pluginsDir: string) {}

  get plugins(): readonly LoadedPlugin[] {
    return this.loaded;
  }

  async loadAll(): Promise<number> {
    this.loaded = [];

    let entries: string[];
    try {
      entries = await readdir(this.pluginsDir);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return 0;
      }
      throw error;
    }

    const files = entries
      .filter((name) => PLUGIN_EXT.test(name))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const fullPath = join(this.pluginsDir, file);
      const mod = await import(pathToFileURL(fullPath).href);
      const plugin = (mod.default ?? mod) as BunPadPlugin;

      if (!plugin || typeof plugin !== "object") {
        console.warn(`[plugins] skipping ${file}: invalid export`);
        continue;
      }

      const id = plugin.name ?? file.replace(/\.[^.]+$/, "");
      this.loaded.push({ id, path: fullPath, plugin });
      console.log(`[plugins] loaded ${id} (${file})`);
    }

    return this.loaded.length;
  }

  async activateAll(ctx: EditorContextImpl): Promise<void> {
    for (const { id, plugin } of this.loaded) {
      try {
        await plugin.activate?.(ctx);
        await plugin.onEditorReady?.(ctx);
      } catch (error) {
        console.error(`[plugins] ${id} activate failed:`, error);
      }
    }
  }

  scheduleTextChange(ctx: EditorContextImpl): void {
    if (this.textChangeScheduled) {
      return;
    }

    this.textChangeScheduled = true;
    queueMicrotask(() => {
      this.textChangeScheduled = false;
      void this.emitTextChange(ctx);
    });
  }

  async emitTextChange(ctx: EditorContextImpl): Promise<void> {
    for (const { id, plugin } of this.loaded) {
      if (!plugin.onTextChange) {
        continue;
      }

      try {
        await plugin.onTextChange(ctx);
      } catch (error) {
        console.error(`[plugins] ${id} onTextChange failed:`, error);
      }
    }
  }

  async runBeforeSave(ctx: EditorContextImpl, text: string): Promise<string> {
    let current = text;

    for (const { id, plugin } of this.loaded) {
      if (!plugin.onBeforeSave) {
        continue;
      }

      try {
        const result = await plugin.onBeforeSave(ctx);
        if (typeof result === "string") {
          current = result;
        }
      } catch (error) {
        console.error(`[plugins] ${id} onBeforeSave failed:`, error);
      }
    }

    return current;
  }

  async emitThemeChange(ctx: EditorContextImpl): Promise<void> {
    for (const { id, plugin } of this.loaded) {
      if (!plugin.onThemeChange) {
        continue;
      }

      try {
        await plugin.onThemeChange(ctx);
      } catch (error) {
        console.error(`[plugins] ${id} onThemeChange failed:`, error);
      }
    }
  }
}
