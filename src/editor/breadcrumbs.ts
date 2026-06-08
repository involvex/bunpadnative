/** Split a file path into clickable breadcrumb segments. */
export const pathSegments = (filePath: string | null): string[] => {
  if (!filePath) {
    return ["Untitled"];
  }

  const normalized = filePath.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length === 0) {
    return ["Untitled"];
  }

  if (parts.length === 1) {
    return parts;
  }

  const segments: string[] = [];
  if (/^[A-Za-z]:$/.test(parts[0]!)) {
    segments.push(parts[0]!);
    for (let index = 1; index < parts.length; index += 1) {
      segments.push(parts[index]!);
    }
    return segments;
  }

  return parts;
};

/** Absolute path for a breadcrumb segment index. */
export const pathForSegment = (
  filePath: string | null,
  segmentIndex: number,
): string | null => {
  if (!filePath) {
    return null;
  }

  const segments = pathSegments(filePath);
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    return null;
  }

  const normalized = filePath.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  if (/^[A-Za-z]:/.test(parts[0]!)) {
    const drive = parts[0]!.slice(0, 2);
    const rest = parts.slice(1, segmentIndex + 1);
    return [drive, ...rest].join("\\");
  }

  return parts.slice(0, segmentIndex + 1).join("\\");
};
