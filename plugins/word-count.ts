import type { BunPadPlugin } from "../src/plugins/types";

let lastLoggedLength = -1;

/** Logs buffer length on text change (console only — no blocking UI). */
const plugin: BunPadPlugin = {
  name: "word-count",

  onEditorReady(ctx) {
    lastLoggedLength = ctx.getText().length;
    console.log(`[word-count] editor ready (${lastLoggedLength} chars)`);
  },

  onTextChange(ctx) {
    const length = ctx.getText().length;
    if (length === lastLoggedLength) {
      return;
    }

    lastLoggedLength = length;
    const words = ctx.getText().trim().split(/\s+/).filter(Boolean).length;
    console.log(`[word-count] ${words} words, ${length} chars`);
  },
};

export default plugin;
