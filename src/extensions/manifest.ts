export type ExtensionManifest = {
  name: string;
  publisher?: string;
  version: string;
  engines?: { vscode?: string };
  main?: string;
  browser?: string;
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
    }>;
  };
};

export type ContributedCommand = {
  command: string;
  title: string;
  category?: string;
};

export type ParsedExtension = {
  id: string;
  rootDir: string;
  manifest: ExtensionManifest;
  mainPath: string;
  activationEvents: string[];
  commands: ContributedCommand[];
};

const STARTUP_EVENTS = new Set(["*", "onStartupFinished"]);

export const shouldActivateOnStartup = (events: string[]): boolean =>
  events.some((event) => STARTUP_EVENTS.has(event));

export const parseManifest = (
  rootDir: string,
  raw: unknown,
): ParsedExtension => {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid extension manifest in ${rootDir}`);
  }

  const manifest = raw as ExtensionManifest;
  if (!manifest.name || !manifest.version) {
    throw new Error(`Extension manifest missing name/version: ${rootDir}`);
  }

  const main = manifest.main ?? manifest.browser;
  if (!main) {
    throw new Error(`Extension manifest missing main entry: ${rootDir}`);
  }

  const publisher = manifest.publisher ?? "unknown";
  const activationEvents = manifest.activationEvents ?? ["onStartupFinished"];
  const commands = manifest.contributes?.commands ?? [];

  return {
    id: `${publisher}.${manifest.name}`,
    rootDir,
    manifest,
    mainPath: main.replace(/^\.\//, ""),
    activationEvents,
    commands,
  };
};

export const matchesEngine = (engine?: string): boolean => {
  if (!engine) {
    return true;
  }

  const match = /^(\^|>=)?(\d+)\./.exec(engine);
  if (!match) {
    return true;
  }

  const major = Number(match[2]);
  return major <= 1 || major === 1;
};
