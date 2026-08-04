/** Glyph order in `font.strip` — must match `tools/genart/sprites/ui.ts` FONT_GLYPH_ORDER. */
export const FONT_GLYPHS =
  ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:/-%!?\'+=' as const;

export const GLYPH_WIDTH = 6;
export const GLYPH_HEIGHT = 7;
export const GLYPHS_PER_ROW = 24;
export const FONT_SCALE = 2;

const SUPPORTED = new Set(FONT_GLYPHS.split(''));

/** Uppercase and keep only supported glyphs. */
export function normalizePixelText(text: string): string {
  return text
    .toUpperCase()
    .split('')
    .filter((char) => SUPPORTED.has(char))
    .join('');
}

/** Index into the font strip for one character, or -1 when unsupported. */
export function glyphIndex(char: string): number {
  const upper = char.length === 1 ? char.toUpperCase() : '';
  if (!SUPPORTED.has(upper)) return -1;
  return FONT_GLYPHS.indexOf(upper);
}

/** Background position in native pixels for one glyph at the given scale. */
export function glyphBackgroundPosition(
  char: string,
  scale = FONT_SCALE,
): { x: number; y: number } {
  const index = glyphIndex(char);
  if (index < 0) return { x: 0, y: 0 };
  const col = index % GLYPHS_PER_ROW;
  const row = Math.floor(index / GLYPHS_PER_ROW);
  const xOffset = col * GLYPH_WIDTH * scale;
  const yOffset = row * GLYPH_HEIGHT * scale;
  return {
    x: xOffset === 0 ? 0 : -xOffset,
    y: yOffset === 0 ? 0 : -yOffset,
  };
}

/** Background X offset — convenience for single-row layouts. */
export function glyphBackgroundX(char: string, scale = FONT_SCALE): number {
  return glyphBackgroundPosition(char, scale).x;
}
