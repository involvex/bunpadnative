import type { Disposable } from "./types";

type CommandHandler = (...args: unknown[]) => unknown;

/** VS Code commands API backed by in-memory handlers. */
export class CommandRegistry {
  private readonly handlers = new Map<string, CommandHandler>();

  registerCommand(
    command: string,
    callback: CommandHandler,
  ): Disposable {
    this.handlers.set(command, callback);
    return {
      dispose: () => {
        this.handlers.delete(command);
      },
    };
  }

  async executeCommand<T = unknown>(
    command: string,
    ...args: unknown[]
  ): Promise<T> {
    const handler = this.handlers.get(command);
    if (!handler) {
      throw new Error(`Command not found: ${command}`);
    }
    return (await handler(...args)) as T;
  }

  has(command: string): boolean {
    return this.handlers.has(command);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const commands = new CommandRegistry();
