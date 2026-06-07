import { vscodeBridge, VscodeBridge } from "./bridge";
import { commands, CommandRegistry } from "./commands";
import { createWindowApi } from "./window";
import {
  EndOfLine,
  FileType,
  Position,
  Range,
  Selection,
  Uri,
} from "./types";

export type {
  Disposable,
  Event,
  ExtensionContext,
  FileStat,
  TextEditorEdit,
} from "./types";

export {
  EndOfLine,
  FileType,
  Position,
  Range,
  Selection,
  Uri,
  commands,
  CommandRegistry,
  vscodeBridge,
  VscodeBridge,
};

export const window = createWindowApi(vscodeBridge);

export const workspace = vscodeBridge.workspace;

export const version = "1.85.0-bunpad";

export const env = {
  appName: "BunPad Native",
  language: "en",
  machineId: "bunpad-native",
  sessionId: "bunpad-native",
  uriScheme: "file",
};

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
  Active = -1,
  Beside = -2,
}

export enum TextDocumentSaveReason {
  Manual = 1,
  AfterDelay = 2,
  FocusOut = 3,
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

const api = {
  version,
  env,
  window,
  workspace,
  commands,
  Uri,
  Position,
  Range,
  Selection,
  EndOfLine,
  FileType,
  StatusBarAlignment,
  ViewColumn,
  TextDocumentSaveReason,
  TextEditorRevealType,
};

export default api;
