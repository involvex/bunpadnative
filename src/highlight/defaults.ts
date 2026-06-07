import type { ThemeTokenColors } from "./types";

/** High-contrast defaults when theme JSON omits `tokens`. */
export const DEFAULT_TOKEN_COLORS: ThemeTokenColors = {
  comment: "#8be9fd",
  string: "#f1fa8c",
  keyword: "#66d9ff",
  number: "#bd93f9",
  type: "#8be9fd",
  function: "#50fa7b",
  operator: "#ffffff",
  punctuation: "#f8f8f2",
};
