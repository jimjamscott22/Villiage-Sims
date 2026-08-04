import { assertPaletteHex, toRgba, type Rgba } from './palette';
import { Raster } from './raster';

/**
 * Declarative pixel grid. `palette` maps single-character keys to a palette hex
 * (or `null` for transparent). `.` is conventionally transparent but any key works.
 */
export interface SpriteGrid {
  size: [number, number];
  palette: Record<string, string | null>;
  rows: string[];
}

/** Rasterize a sprite grid. Throws if dimensions disagree or a color is off-palette. */
export function rasterizeGrid(def: SpriteGrid): Raster {
  const [width, height] = def.size;
  if (def.rows.length !== height) {
    throw new Error(`Expected ${height} rows, got ${def.rows.length}`);
  }
  for (const row of def.rows) {
    if (row.length !== width) {
      throw new Error(`Expected row width ${width}, got ${row.length}`);
    }
  }

  const resolved = new Map<string, Rgba | null>();
  for (const [key, hex] of Object.entries(def.palette)) {
    if (hex == null) {
      resolved.set(key, null);
      continue;
    }
    const name = assertPaletteHex(hex);
    resolved.set(key, toRgba(name));
  }

  const raster = new Raster(width, height);
  for (let y = 0; y < height; y += 1) {
    const row = def.rows[y];
    for (let x = 0; x < width; x += 1) {
      const key = row[x];
      if (!resolved.has(key)) {
        throw new Error(`Unknown palette key '${key}' at (${x},${y})`);
      }
      const color = resolved.get(key)!;
      if (color) raster.set(x, y, color);
    }
  }
  return raster;
}

/** Horizontally mirror a raster (used for West = East mirrored). */
export function mirrorHorizontal(source: Raster): Raster {
  const out = new Raster(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const pixel = source.get(x, y);
      if (pixel[3] === 0) continue;
      out.set(source.width - 1 - x, y, pixel);
    }
  }
  return out;
}

/**
 * Remap every pixel matching `from` to `to`. Both must be palette hexes.
 * Used to expand a dye-placeholder garment into multiple dye variants.
 */
export function remapColor(source: Raster, fromHex: string, toHex: string): Raster {
  const from = toRgba(assertPaletteHex(fromHex));
  const to = toRgba(assertPaletteHex(toHex));
  const out = new Raster(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const pixel = source.get(x, y);
      if (pixel[3] === 0) continue;
      if (pixel[0] === from[0] && pixel[1] === from[1] && pixel[2] === from[2]) {
        out.set(x, y, to);
      } else {
        out.set(x, y, pixel);
      }
    }
  }
  return out;
}
