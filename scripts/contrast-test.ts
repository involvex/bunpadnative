/**
 * WCAG contrast checks for built-in dark themes.
 * Run: bun run scripts/contrast-test.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseTheme } from "../src/theme/validate";

const THEMES_DIR = join(process.cwd(), "themes");
const MIN_BODY_RATIO = 4.5;
const MIN_TOKEN_RATIO = 3;

const channelLinear = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string): number => {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * channelLinear(r) +
    0.7152 * channelLinear(g) +
    0.0722 * channelLinear(b)
  );
};

const contrastRatio = (foreground: string, background: string): number => {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

const files = (await readdir(THEMES_DIR)).filter((name) =>
  name.endsWith(".json"),
);

const failures: string[] = [];

for (const file of files) {
  const raw = JSON.parse(await readFile(join(THEMES_DIR, file), "utf8"));
  const theme = parseTheme(raw, file);

  if (!theme.chrome.darkTitleBar) {
    continue;
  }

  const bg = theme.editor.background;
  const fgRatio = contrastRatio(theme.editor.foreground, bg);
  if (fgRatio < MIN_BODY_RATIO) {
    failures.push(
      `${theme.id}: editor.foreground ratio ${fgRatio.toFixed(2)} < ${MIN_BODY_RATIO}`,
    );
  }

  if (!theme.tokens) {
    continue;
  }

  for (const [kind, color] of Object.entries(theme.tokens)) {
    const min =
      kind === "comment" || kind === "punctuation" || kind === "operator"
        ? MIN_BODY_RATIO
        : MIN_TOKEN_RATIO;
    const ratio = contrastRatio(color, bg);
    if (ratio < min) {
      failures.push(
        `${theme.id}: tokens.${kind} ratio ${ratio.toFixed(2)} < ${min}`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Contrast failures:\n${failures.join("\n")}`);
}

console.log("contrast-test ok");
