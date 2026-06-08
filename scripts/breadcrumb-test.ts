/**
 * File-path breadcrumb segment parsing tests.
 * Run: bun run test:breadcrumb
 */
import { pathForSegment, pathSegments } from "../src/editor/breadcrumbs";

if (JSON.stringify(pathSegments(null)) !== JSON.stringify(["Untitled"])) {
  throw new Error("Expected Untitled for null path");
}

const winPath = "D:\\repos\\bunpadnative\\src\\app\\window.ts";
const segments = pathSegments(winPath);
if (segments.join("/") !== "D:/repos/bunpadnative/src/app/window.ts") {
  throw new Error(`Unexpected segments: ${segments.join(" > ")}`);
}

const driveRoot = pathForSegment(winPath, 0);
if (driveRoot !== "D:") {
  throw new Error(`Expected D: at index 0, got ${driveRoot}`);
}

const repoPath = pathForSegment(winPath, 1);
if (repoPath !== "D:\\repos") {
  throw new Error(`Expected D:\\repos at index 1, got ${repoPath}`);
}

const filePath = pathForSegment(winPath, segments.length - 1);
if (filePath !== winPath) {
  throw new Error(`Expected full path for file segment, got ${filePath}`);
}

const unixish = pathSegments("/tmp/readme.md");
if (unixish.join("/") !== "tmp/readme.md") {
  throw new Error(`Unexpected unix-style segments: ${unixish.join("/")}`);
}

console.log("breadcrumb-test ok");
