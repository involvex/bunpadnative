/**
 * Editor settings merge and persistence tests.
 * Run: bun run test:settings
 */
import { join } from "node:path";
import { rm } from "node:fs/promises";

import { SettingsStore } from "../src/app/settings";
import { DEFAULT_EDITOR_SETTINGS } from "../src/theme/types";

const tmpDir = join(process.cwd(), ".tmp-settings-test");
const settingsPath = join(tmpDir, "settings.json");

await rm(tmpDir, { recursive: true, force: true });

const store = new SettingsStore(settingsPath);
await store.load();

const defaults = store.editor;
if (defaults.wordCompletion !== DEFAULT_EDITOR_SETTINGS.wordCompletion) {
  throw new Error("Expected default wordCompletion");
}
if (
  defaults.completionMinChars !== DEFAULT_EDITOR_SETTINGS.completionMinChars
) {
  throw new Error("Expected default completionMinChars");
}
if (defaults.showBreadcrumbs !== DEFAULT_EDITOR_SETTINGS.showBreadcrumbs) {
  throw new Error("Expected default showBreadcrumbs");
}

await store.setEditorSettings({
  ...defaults,
  wordCompletion: false,
  showBreadcrumbs: false,
});

const reloaded = new SettingsStore(settingsPath);
await reloaded.load();
if (reloaded.editor.wordCompletion !== false) {
  throw new Error("Expected wordCompletion=false after save");
}
if (reloaded.editor.showBreadcrumbs !== false) {
  throw new Error("Expected showBreadcrumbs=false after save");
}
if (
  reloaded.editor.autoCloseBrackets !==
  DEFAULT_EDITOR_SETTINGS.autoCloseBrackets
) {
  throw new Error("Expected unrelated editor defaults preserved");
}

await rm(tmpDir, { recursive: true, force: true });
console.log("settings-test ok");
