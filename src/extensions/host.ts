import { mkdir, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { commands } from "../vscode/commands";
import { Uri } from "../vscode/types";
import {
  matchesEngine,
  parseManifest,
  shouldActivateOnStartup,
  type ContributedCommand,
  type ParsedExtension,
} from "./manifest";

export type LoadedExtension = {
  parsed: ParsedExtension;
  activated: boolean;
};

export type ExtensionCommand = ContributedCommand & {
  menuCommandId: number;
};

export enum ExtensionMenuCommand {
  Reload = 1202,
  CommandBase = 1400,
  CommandMax = 1499,
}

/** Loads VS Code-style extensions from extensions/ directories. */
export class ExtensionHost {
  private loaded: LoadedExtension[] = [];
  private commandMap = new Map<number, string>();
  private readonly vscodeShimPath: string;

  constructor(
    readonly extensionsDir: string,
    projectRoot = process.cwd(),
  ) {
    this.vscodeShimPath = join(projectRoot, "vscode-shim");
  }

  get extensions(): readonly LoadedExtension[] {
    return this.loaded;
  }

  get contributedCommands(): ExtensionCommand[] {
    const items: ExtensionCommand[] = [];

    for (const [menuCommandId, commandId] of this.commandMap.entries()) {
      const match = this.loaded
        .flatMap((entry) => entry.parsed.commands)
        .find((command) => command.command === commandId);
      if (match) {
        items.push({ ...match, menuCommandId });
      }
    }

    return items.sort((a, b) => a.title.localeCompare(b.title));
  }

  commandIdForMenu(menuCommandId: number): string | null {
    return this.commandMap.get(menuCommandId) ?? null;
  }

  async loadAll(): Promise<number> {
    this.loaded = [];
    this.commandMap.clear();
    commands.clear();

    let entries;
    try {
      entries = await readdir(this.extensionsDir, { withFileTypes: true });
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

    for (const entry of entries.filter((item) => item.isDirectory())) {
      const rootDir = join(this.extensionsDir, entry.name);
      try {
        const raw = JSON.parse(
          await readFile(join(rootDir, "package.json"), "utf8"),
        );
        const parsed = parseManifest(rootDir, raw);

        if (!matchesEngine(parsed.manifest.engines?.vscode)) {
          console.warn(`[extensions] skipping ${parsed.id}: engine mismatch`);
          continue;
        }

        await this.ensureVscodeShim(rootDir);
        this.loaded.push({ parsed, activated: false });
        console.log(`[extensions] discovered ${parsed.id}`);
      } catch (error) {
        console.warn(`[extensions] skipping ${entry.name}:`, error);
      }
    }

    this.rebuildCommandMenuMap();
    return this.loaded.length;
  }

  async activateStartup(): Promise<void> {
    for (const entry of this.loaded) {
      if (shouldActivateOnStartup(entry.parsed.activationEvents)) {
        await this.activate(entry);
      }
    }
  }

  async executeMenuCommand(menuCommandId: number): Promise<void> {
    const command = this.commandMap.get(menuCommandId);
    if (!command) {
      return;
    }
    await this.executeCommand(command);
  }

  async executeCommand(command: string): Promise<void> {
    const entry = this.findExtensionForCommand(command);
    if (entry && !entry.activated) {
      await this.activate(entry);
    }

    await commands.executeCommand(command);
  }

  private findExtensionForCommand(command: string): LoadedExtension | undefined {
    return this.loaded.find(
      (entry) =>
        entry.parsed.commands.some((item) => item.command === command) ||
        entry.parsed.activationEvents.includes(`onCommand:${command}`),
    );
  }

  private rebuildCommandMenuMap(): void {
    this.commandMap.clear();
    let menuId = ExtensionMenuCommand.CommandBase;

    const allCommands = this.loaded
      .flatMap((entry) => entry.parsed.commands)
      .sort((a, b) => a.title.localeCompare(b.title));

    for (const command of allCommands) {
      if (menuId > ExtensionMenuCommand.CommandMax) {
        break;
      }
      this.commandMap.set(menuId, command.command);
      menuId += 1;
    }
  }

  private async ensureVscodeShim(extensionRoot: string): Promise<void> {
    const nodeModules = join(extensionRoot, "node_modules");
    const vscodeLink = join(nodeModules, "vscode");

    if (existsSync(vscodeLink)) {
      return;
    }

    await mkdir(nodeModules, { recursive: true });
    await symlink(this.vscodeShimPath, vscodeLink, "junction");
  }

  private async activate(entry: LoadedExtension): Promise<void> {
    if (entry.activated) {
      return;
    }

    const mainFile = join(entry.parsed.rootDir, entry.parsed.mainPath);
    const mod = await import(pathToFileURL(mainFile).href);
    const activate = mod.activate ?? mod.default?.activate;

    if (typeof activate !== "function") {
      throw new Error(`Extension ${entry.parsed.id} missing activate()`);
    }

    const context = {
      subscriptions: [] as Array<{ dispose(): void }>,
      extensionPath: entry.parsed.rootDir,
      extensionUri: Uri.file(entry.parsed.rootDir),
    };

    await activate(context);
    entry.activated = true;
    console.log(`[extensions] activated ${entry.parsed.id}`);
  }
}
