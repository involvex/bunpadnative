import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { parseManifest } from "../extensions/manifest";
import { getAppRoot } from "./paths";

const PLUGIN_EXT = /\.(?:ts|js|mts|mjs)$/i;
const OPEN_VSX_BASE = "https://open-vsx.org/api";

export type OpenVsxExtensionMeta = {
  namespace: string;
  name: string;
  version: string;
  files?: { download?: string };
};

/** Split `publisher.extension` into Open VSX namespace and name. */
export const parseMarketplaceExtensionId = (
  extensionId: string,
): { namespace: string; name: string } => {
  const trimmed = extensionId.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot >= trimmed.length - 1) {
    throw new Error(
      "Extension id must be publisher.name (e.g. editorconfig.editorconfig).",
    );
  }

  return {
    namespace: trimmed.slice(0, dot),
    name: trimmed.slice(dot + 1),
  };
};

/** Fetch latest extension metadata from Open VSX. */
export const fetchOpenVsxExtension = async (
  extensionId: string,
): Promise<OpenVsxExtensionMeta> => {
  const { namespace, name } = parseMarketplaceExtensionId(extensionId);
  const url = `${OPEN_VSX_BASE}/${namespace}/${name}/latest`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Extension not found on Open VSX: ${extensionId}`);
  }

  return (await response.json()) as OpenVsxExtensionMeta;
};

const extractVsix = async (
  vsixPath: string,
  destinationDir: string,
): Promise<string> => {
  await mkdir(destinationDir, { recursive: true });
  const escapedVsix = vsixPath.replace(/'/g, "''");
  const escapedDest = destinationDir.replace(/'/g, "''");
  const proc = Bun.spawn(
    [
      "powershell.exe",
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${escapedVsix}' -DestinationPath '${escapedDest}' -Force`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract VSIX: ${err.trim() || `exit ${code}`}`);
  }

  const extensionDir = join(destinationDir, "extension");
  try {
    await stat(join(extensionDir, "package.json"));
  } catch {
    throw new Error("Downloaded VSIX does not contain extension/package.json.");
  }

  return extensionDir;
};

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

/** Download an extension VSIX from Open VSX and install it locally. */
export const importExtensionFromMarketplace = async (
  extensionId: string,
): Promise<string> => {
  const meta = await fetchOpenVsxExtension(extensionId);
  const downloadUrl =
    meta.files?.download ??
    `${OPEN_VSX_BASE}/${meta.namespace}/${meta.name}/${meta.version}/file/download`;

  const tmpRoot = join(tmpdir(), `bunpad-vsix-${Date.now()}`);
  const vsixPath = join(tmpRoot, `${meta.namespace}.${meta.name}.vsix`);

  try {
    await mkdir(tmpRoot, { recursive: true });
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download VSIX for ${meta.namespace}.${meta.name}.`,
      );
    }

    await Bun.write(vsixPath, await response.arrayBuffer());
    const extensionDir = await extractVsix(vsixPath, join(tmpRoot, "extract"));
    return await importExtensionFolder(extensionDir);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};
