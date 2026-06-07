import type { BunPadPlugin } from "../src/plugins/types";

/** Trims trailing whitespace from each line before save. */
const plugin: BunPadPlugin = {
  name: "trim-trailing",

  onBeforeSave(ctx) {
    return ctx.getText().replace(/[ \t]+$/gm, "");
  },
};

export default plugin;
