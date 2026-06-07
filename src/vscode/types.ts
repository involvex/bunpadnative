/** Minimal Position type aligned with VS Code API. */
export class Position {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}

  isBefore(other: Position): boolean {
    return (
      this.line < other.line ||
      (this.line === other.line && this.character < other.character)
    );
  }

  isAfter(other: Position): boolean {
    return (
      this.line > other.line ||
      (this.line === other.line && this.character > other.character)
    );
  }

  compareTo(other: Position): number {
    if (this.line !== other.line) {
      return this.line - other.line;
    }
    return this.character - other.character;
  }
}

/** Minimal Range type aligned with VS Code API. */
export class Range {
  readonly start: Position;
  readonly end: Position;
  readonly isEmpty: boolean;

  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
  );
  constructor(start: Position, end: Position);
  constructor(
    a: number | Position,
    b: number | Position,
    c?: number,
    d?: number,
  ) {
    if (typeof a === "number") {
      this.start = new Position(a, b as number);
      this.end = new Position(c!, d!);
    } else {
      this.start = a;
      this.end = b as Position;
    }
    this.isEmpty =
      this.start.line === this.end.line &&
      this.start.character === this.end.character;
  }

  contains(position: Position): boolean {
    return (
      position.compareTo(this.start) >= 0 && position.compareTo(this.end) <= 0
    );
  }
}

/** Minimal Selection type aligned with VS Code API. */
export class Selection extends Range {
  constructor(
    anchorLine: number,
    anchorCharacter: number,
    activeLine: number,
    activeCharacter: number,
  ) {
    super(
      Math.min(anchorLine, activeLine),
      anchorLine <= activeLine ? anchorCharacter : activeCharacter,
      Math.max(anchorLine, activeLine),
      anchorLine >= activeLine ? anchorCharacter : activeCharacter,
    );
    this.anchor = new Position(anchorLine, anchorCharacter);
    this.active = new Position(activeLine, activeCharacter);
  }

  readonly anchor: Position;
  readonly active: Position;
}

/** File URI wrapper aligned with VS Code API. */
export class Uri {
  private constructor(
    readonly scheme: string,
    readonly authority: string,
    readonly path: string,
    readonly query: string,
    readonly fragment: string,
  ) {}

  get fsPath(): string {
    if (this.scheme !== "file") {
      return this.path;
    }
    return this.path.replace(/\//g, "\\").replace(/^\\(?=[A-Za-z]:)/, "");
  }

  static file(path: string): Uri {
    const normalized = path.replace(/\\/g, "/");
    return new Uri("file", "", normalized, "", "");
  }

  static parse(value: string): Uri {
    if (value.startsWith("file://")) {
      return Uri.file(decodeURIComponent(value.slice("file://".length)));
    }
    return new Uri("file", "", value, "", "");
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

export enum TextEditKind {
  Create = 1,
  Replace = 2,
}

export type Disposable = {
  dispose(): void;
};

export type Event<T> = (listener: (event: T) => unknown) => Disposable;

export type TextEditorEdit = {
  replace(range: Range, value: string): void;
  insert(location: Position, value: string): void;
  delete(range: Range): void;
};

export type FileStat = {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
};

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export type ExtensionContext = {
  subscriptions: Disposable[];
  extensionPath: string;
  extensionUri: Uri;
};
