export type ThemeColors = {
  background: string;
  foreground: string;
  accent: string;
  border: string;
};

export type ThemeMenuBarColors = {
  background: string;
  foreground: string;
  hover: string;
  active: string;
};

export type ThemeStatusBarColors = {
  background: string;
  foreground: string;
  accent: string;
};

export type ThemeEditorColors = {
  background: string;
  foreground: string;
  selectionBackground: string;
  selectionForeground: string;
  caret: string;
  fontFamily: string;
  fontSize: number;
};

export type ThemeChrome = {
  darkTitleBar: boolean;
};

/** JSON theme definition loaded from themes/ directories. */
export type ThemeDefinition = {
  id: string;
  name: string;
  ui: ThemeColors & {
    menuBar: ThemeMenuBarColors;
    statusBar: ThemeStatusBarColors;
  };
  editor: ThemeEditorColors;
  chrome: ThemeChrome;
};

export type ThemeSummary = {
  id: string;
  name: string;
};

export type AppSettings = {
  theme: string;
};
