/**
 * Canvas text drawn from the `font.strip` bitmap font in the ui atlas, so
 * canvas labels match the HTML PixelText. Layout uses glyph metrics only
 * (6px advance × scale), never `measureText`, so it is identical everywhere.
 *
 * The strip is painted in whitewash; other colours are drawn from a tinted
 * copy cached per colour. When the atlas is missing (the flat-colour
 * fallback), text falls back to the Pixelify Sans web font.
 */
import { THEME } from '../theme/palette';
import {
  FONT_SCALE,
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  GLYPHS_PER_ROW,
  glyphIndex,
  normalizePixelText,
} from '../ui/font';
import type { Atlas } from './atlas';

const FONT_KEY = 'font.strip';
const FALLBACK_FONT_FAMILY = "'Pixelify Sans', sans-serif";

/**
 * Upper-case text and keep only glyphs the strip has. Dashes and ellipses are
 * mapped to ASCII first so labels like "Home — Sleeping" keep their separator.
 */
export function bitmapTextContent(text: string): string {
  return normalizePixelText(text.replace(/[—–]/g, '-').replace(/…/g, '...'));
}

/** Width in px of `text` at `scale` (6px per glyph, spacing included). */
export function bitmapTextWidth(text: string, scale = FONT_SCALE): number {
  return bitmapTextContent(text).length * GLYPH_WIDTH * scale;
}

/** Height in px of one line at `scale`. */
export function bitmapTextHeight(scale = FONT_SCALE): number {
  return GLYPH_HEIGHT * scale;
}

/** Source rect of one glyph inside the sheet, given the strip's origin. Null for unsupported characters. */
export function glyphSourceRect(
  char: string,
  origin: { x: number; y: number },
): [number, number, number, number] | null {
  const index = glyphIndex(char);
  if (index < 0) return null;
  const col = index % GLYPHS_PER_ROW;
  const row = Math.floor(index / GLYPHS_PER_ROW);
  return [origin.x + col * GLYPH_WIDTH, origin.y + row * GLYPH_HEIGHT, GLYPH_WIDTH, GLYPH_HEIGHT];
}

type StripSource = { image: CanvasImageSource; x: number; y: number };

const tintCache = new WeakMap<Atlas, Map<string, StripSource>>();

/** The font strip in `color`: the sheet itself for whitewash, else a cached tinted copy. */
function stripSource(atlas: Atlas, color: string): StripSource | null {
  const cell = atlas.manifest.cells[FONT_KEY];
  const image = cell ? atlas.images[cell.sheet] : undefined;
  if (!cell || !image) return null;
  if (color.toLowerCase() === THEME.whitewash) return { image, x: cell.x, y: cell.y };

  let byColor = tintCache.get(atlas);
  if (!byColor) {
    byColor = new Map();
    tintCache.set(atlas, byColor);
  }
  const cached = byColor.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = cell.w;
  canvas.height = cell.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cell.w, cell.h);
  const tinted = { image: canvas, x: 0, y: 0 };
  byColor.set(color, tinted);
  return tinted;
}

export interface BitmapTextOptions {
  color?: string;
  scale?: number;
  /** Horizontal anchor for `x`. Defaults to left. */
  align?: 'left' | 'center';
}

/**
 * Draw `text` with its top edge at `y`. Returns the drawn width. Positions are
 * rounded so glyphs land on whole pixels in the current transform.
 */
export function drawBitmapText(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas | null,
  text: string,
  x: number,
  y: number,
  { color = THEME.uiText, scale = FONT_SCALE, align = 'left' }: BitmapTextOptions = {},
): number {
  const content = bitmapTextContent(text);
  const width = content.length * GLYPH_WIDTH * scale;
  const left = Math.round(align === 'center' ? x - width / 2 : x);
  const top = Math.round(y);
  const source = atlas ? stripSource(atlas, color) : null;

  if (!source) {
    ctx.save();
    ctx.font = `${bitmapTextHeight(scale)}px ${FALLBACK_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(content, left, top, width);
    ctx.restore();
    return width;
  }

  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < content.length; i += 1) {
    const rect = glyphSourceRect(content[i], source);
    if (!rect) continue;
    const [sx, sy, sw, sh] = rect;
    ctx.drawImage(source.image, sx, sy, sw, sh, left + i * GLYPH_WIDTH * scale, top, sw * scale, sh * scale);
  }
  ctx.imageSmoothingEnabled = previousSmoothing;
  return width;
}
