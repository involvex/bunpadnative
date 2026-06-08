import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { parseManifest } from "../extensions/manifest";
import { getAppRoot } from "./paths";

const PLUGIN_EXT = /\.(?:ts|js|mts|mjs)$/i;

/** Copy a plugin source file or folder into plugins/. */
export const importPluginFolder = async (
  sourcePath: string,
): Promise<string> => {
  const destRoot = join(getAppRoot(), "plugins");
  await mkdir(destRoot, { recursive: true });

  const info = await stat(sourcePath);
  if (info.isDirectory()) {
    const entries = await readdir(sourcePath);
    const pluginFiles = entries.filter((name) => PLUGIN_EXT.test(name));
    if (pluginFiles.length === 0) {
      throw new Error("No .ts/.js plugin files found in folder.");
    }

    const folderName = basename(sourcePath);
    const destDir = join(destRoot, folderName);
    await cp(sourcePath, destDir, { recursive: true, force: true });
    return destDir;
  }

  if (!PLUGIN_EXT.test(sourcePath)) {
    throw new Error("Plugin file must be .ts, .js, .mts, or .mjs.");
  }

  const dest = join(destRoot, basename(sourcePath));
  await cp(sourcePath, dest);
  return dest;
};

/** Resolve extension root from a folder or package.json path. */
export const extensionRootFromPath = (sourcePath: string): string => {
  if (basename(sourcePath).toLowerCase() === "package.json") {
    return dirname(sourcePath);
  }
  return sourcePath;
};

/** Copy a VS Code extension folder into extensions/. */
export const importExtensionFolder = async (
  sourcePath: string,
): Promise<string> => {
  const root = extensionRootFromPath(sourcePath);
  const manifestPath = join(root, "package.json");
  const raw = JSON.parse(await Bun.file(manifestPath).text());
  const parsed = parseManifest(root, raw);

  const destRoot = join(getAppRoot(), "extensions");
  await mkdir(destRoot, { recursive: true });
  const destDir = join(destRoot, parsed.manifest.name);
  await cp(root, destDir, { recursive: true, force: true });
  return destDir;
};

/** Copy a theme JSON file into user themes folder. */
export const importThemeFile = async (
  sourcePath: string,
  userThemesFolder: string,
): Promise<string> => {
  if (!sourcePath.toLowerCase().endsWith(".json")) {
    throw new Error("Theme file must be a .json file.");
  }

  await mkdir(userThemesFolder, { recursive: true });
  const dest = join(userThemesFolder, basename(sourcePath));
  await cp(sourcePath, dest);
  return dest;
};

/** Placeholder for future Open VSX / marketplace downloads. */
export const importExtensionFromMarketplace = (
  _extensionId: string,
): Promise<never> =>
  Promise.reject(new Error("Marketplace install is not implemented yet."));
