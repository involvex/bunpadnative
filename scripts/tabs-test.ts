/**
 * TabManager model verification (pure TS, no HWND).
 * Run: bun run test:tabs
 */
import { TabManager } from "../src/app/tabs";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`tabs-test: ${message}`);
  }
};

const manager = new TabManager();
assert(manager.count === 1, "starts with one untitled tab");
assert(manager.activeIndex === 0, "active starts at 0");
assert(manager.canAdoptForOpen(), "pristine untitled can adopt open");

// Adopt first open (no extra tab).
manager.adoptFileText("C:\\tmp\\a.txt", "hello");
assert(manager.count === 1, "adopt keeps single tab");
assert(!manager.canAdoptForOpen(), "adopted tab cannot re-adopt");
assert(
  manager.labels()[0]!.label === "a.txt",
  `adopt label, got ${manager.labels()[0]!.label}`,
);

// Dirty tracking.
manager.updateActiveText("hello world");
assert(manager.activeDocument.dirty, "edited text marks dirty");
assert(manager.labels()[0]!.dirty, "label reports dirty");
manager.snapshotActive("hello world", 5);
assert(manager.tabAt(0)!.cursor === 5, "cursor snapshot");

// Second file opens a new tab.
manager.openFileText("C:\\tmp\\b.txt", "second");
assert(manager.count === 2, "second file adds tab");
assert(manager.activeIndex === 1, "new file becomes active");
assert(
  manager.labels()[1]!.label === "b.txt",
  `second label, got ${manager.labels()[1]!.label}`,
);

// Existing path focuses instead of duplicating.
manager.openFileText("C:\\tmp\\a.txt", "hello world");
assert(manager.count === 2, "reopen focuses, no duplicate");
assert(manager.activeIndex === 0, "reopen focuses first tab");

// Navigation wraps.
manager.setActive(1);
manager.next();
assert(manager.activeIndex === 0, "next wraps");
manager.previous();
assert(manager.activeIndex === 1, "previous wraps");

// New untitled + close flows.
manager.newUntitled();
assert(manager.count === 3, "new untitled adds tab");
manager.closeAt(2);
assert(manager.count === 2, "close removes tab");
assert(manager.activeIndex === 1, "close last keeps valid active");
manager.closeAt(0);
assert(manager.count === 1, "close first keeps one tab");

console.log("tabs-test ok");
console.log(`  tabs=${manager.count} active=${manager.activeIndex}`);
