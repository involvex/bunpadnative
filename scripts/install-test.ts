/**
 * Open VSX marketplace id parsing tests.
 * Run: bun run test:install
 */
import { parseMarketplaceExtensionId } from "../src/app/install";

const parsed = parseMarketplaceExtensionId("editorconfig.editorconfig");
if (parsed.namespace !== "editorconfig" || parsed.name !== "editorconfig") {
  throw new Error("Failed to parse publisher.name extension id");
}

let threw = false;
try {
  parseMarketplaceExtensionId("invalid-id");
} catch {
  threw = true;
}
if (!threw) {
  throw new Error("Expected invalid extension id to throw");
}

console.log("install-test ok");
