import type { Disposable, Event } from "./types";

type Listener<T> = (event: T) => unknown;

/** Lightweight VS Code-style event emitter. */
export class EventEmitter<T> {
  private listeners = new Set<Listener<T>>();

  readonly event: Event<T> = (listener) => {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  };

  fire(event: T): void {
    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export const combineDisposables = (
  ...disposables: Disposable[]
): Disposable => ({
  dispose: () => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  },
});
