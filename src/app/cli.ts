import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

const expandTilde = (path: string): string => {
  if (path.startsWith("~")) {
    return path.replace(/^~/, process.env.USERPROFILE ?? homedir());
  }
  return path;
};

/** First positional CLI argument that looks like a file path to open. */
export const parseStartupFilePath = (
  argv: readonly string[],
): string | null => {
  const invokedByBun = /bun(?:\.exe)?$/i.test(argv[0] ?? "");

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg || arg.startsWith("-")) {
      continue;
    }

    if (invokedByBun && i === 1 && /\.(ts|js)$/i.test(arg)) {
      continue;
    }

    const expanded = expandTilde(arg);
    return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
  }

  return null;
};

/** When stdin is piped, read a single path line (e.g. `echo file.ts | bunpad`). */
export const readStartupFileFromStdin = async (): Promise<string | null> => {
  if (process.stdin.isTTY) {
    return null;
  }

  const text = (await Bun.stdin.text()).trim();
  if (!text) {
    return null;
  }

  const line = text.split(/\r?\n/, 1)[0]?.trim();
  if (!line) {
    return null;
  }

  const expanded = expandTilde(line);
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
};

/** Resolve startup file from argv, then optional stdin path. */
export const resolveStartupFile = async (
  argv: readonly string[] = process.argv,
): Promise<string | null> => {
  const fromArgv = parseStartupFilePath(argv);
  if (fromArgv) {
    return fromArgv;
  }

  return readStartupFileFromStdin();
};

export const assertReadableFile = (path: string): void => {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
};
