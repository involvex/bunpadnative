import type { ThemeDefinition } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;

const requireHex = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !HEX.test(value)) {
    throw new Error(`Theme field ${field} must be #RRGGBB`);
  }
  return value;
};

/** Validate and normalize a parsed theme JSON object. */
export const parseTheme = (raw: unknown, source: string): ThemeDefinition => {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid theme JSON: ${source}`);
  }

  const theme = raw as Record<string, unknown>;
  const id = theme.id;
  const name = theme.name;
  if (typeof id !== "string" || !id) {
    throw new Error(`Theme ${source} missing id`);
  }
  if (typeof name !== "string" || !name) {
    throw new Error(`Theme ${source} missing name`);
  }

  const ui = theme.ui as Record<string, unknown>;
  const menuBar = ui.menuBar as Record<string, unknown>;
  const statusBar = ui.statusBar as Record<string, unknown>;
  const editor = theme.editor as Record<string, unknown>;
  const chrome = theme.chrome as Record<string, unknown>;
  const tokensRaw = theme.tokens as Record<string, unknown> | undefined;

  const fontSize = editor.fontSize;
  if (typeof fontSize !== "number" || fontSize < 8 || fontSize > 72) {
    throw new Error(`Theme ${id} editor.fontSize must be 8-72`);
  }

  const parseTokens = (): ThemeDefinition["tokens"] => {
    if (!tokensRaw) {
      return undefined;
    }

    return {
      comment: requireHex(tokensRaw.comment, "tokens.comment"),
      string: requireHex(tokensRaw.string, "tokens.string"),
      keyword: requireHex(tokensRaw.keyword, "tokens.keyword"),
      number: requireHex(tokensRaw.number, "tokens.number"),
      type: requireHex(tokensRaw.type, "tokens.type"),
      function: requireHex(tokensRaw.function, "tokens.function"),
      operator: requireHex(tokensRaw.operator, "tokens.operator"),
      punctuation: requireHex(tokensRaw.punctuation, "tokens.punctuation"),
    };
  };

  return {
    id,
    name,
    ui: {
      background: requireHex(ui.background, "ui.background"),
      foreground: requireHex(ui.foreground, "ui.foreground"),
      accent: requireHex(ui.accent, "ui.accent"),
      border: requireHex(ui.border, "ui.border"),
      menuBar: {
        background: requireHex(menuBar.background, "ui.menuBar.background"),
        foreground: requireHex(menuBar.foreground, "ui.menuBar.foreground"),
        hover: requireHex(menuBar.hover, "ui.menuBar.hover"),
        active: requireHex(menuBar.active, "ui.menuBar.active"),
      },
      statusBar: {
        background: requireHex(statusBar.background, "ui.statusBar.background"),
        foreground: requireHex(statusBar.foreground, "ui.statusBar.foreground"),
        accent: requireHex(statusBar.accent, "ui.statusBar.accent"),
      },
    },
    editor: {
      background: requireHex(editor.background, "editor.background"),
      foreground: requireHex(editor.foreground, "editor.foreground"),
      selectionBackground: requireHex(
        editor.selectionBackground,
        "editor.selectionBackground",
      ),
      selectionForeground: requireHex(
        editor.selectionForeground,
        "editor.selectionForeground",
      ),
      caret: requireHex(editor.caret, "editor.caret"),
      fontFamily:
        typeof editor.fontFamily === "string" && editor.fontFamily
          ? editor.fontFamily
          : "Consolas",
      fontSize,
    },
    chrome: {
      darkTitleBar: chrome.darkTitleBar === true,
    },
    tokens: parseTokens(),
  };
};
