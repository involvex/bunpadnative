import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

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

    return isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
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

  return isAbsolute(line) ? line : resolve(process.cwd(), line);
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
