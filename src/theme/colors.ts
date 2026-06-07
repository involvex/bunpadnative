/** Parse #RRGGBB to Win32 COLORREF (0x00BBGGRR). */
export const hexToColorRef = (hex: string): number => {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid color: ${hex}`);
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return r | (g << 8) | (b << 16);
};

/** Negated pixel height for CreateFontW (positive em height). */
export const fontSizeToHeight = (pointSize: number): number =>
  -Math.round((pointSize * 96) / 72);
