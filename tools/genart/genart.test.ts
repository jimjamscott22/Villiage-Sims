import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAtlas } from './build';
import { renderPaletteCss } from './css';
import { rasterizeGrid, type SpriteGrid } from './grid';
import { toRgba } from './palette';
import type { Raster } from './raster';
import { FENCE, GATE, SIGNPOST } from './sprites/buildings';
import { CHICKEN_SPRITES } from './sprites/chickens';
import { ART_DIR, THEME_CSS_PATH } from './paths';
import { decodePng } from './png';
import { PANEL } from './sprites/ui';

// The committed PNG is compared by decoded pixels, not raw bytes: zlib output
// varies with the Node version, so a byte comparison would fail spuriously.
describe('committed art', () => {
  const atlas = buildAtlas();

  it('matches the committed manifest', () => {
    const committed = JSON.parse(readFileSync(join(ART_DIR, 'atlas.json'), 'utf8'));
    expect(committed).toEqual(atlas.manifest);
  });

  it('matches the committed sheet pixels', () => {
    for (const sheet of atlas.sheets) {
      const decoded = decodePng(readFileSync(join(ART_DIR, `${sheet.name}.png`)));
      expect(decoded.width).toBe(sheet.width);
      expect(decoded.height).toBe(sheet.height);
      // Byte comparison: toEqual on a sheet-sized array is slow enough to time out under load.
      expect(Buffer.from(decoded.rgba).equals(Buffer.from(sheet.rgba)), sheet.name).toBe(true);
    }
  });

  it('matches the committed border-image panel frame', () => {
    const expected = rasterizeGrid(PANEL);
    const decoded = decodePng(readFileSync(join(ART_DIR, 'panel.png')));
    expect(decoded.width).toBe(expected.width);
    expect(decoded.height).toBe(expected.height);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(expected.rgba));
  });

  it('matches the committed palette CSS', () => {
    expect(readFileSync(THEME_CSS_PATH, 'utf8')).toBe(renderPaletteCss());
  });
});

/**
 * Share of a sprite's edge pixels that are ink. An edge pixel is opaque with a
 * transparent (or out-of-cell) 4-neighbour.
 */
function edgeInkShare(raster: Raster): number {
  const ink = toRgba('ink');
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < raster.width && y < raster.height && raster.get(x, y)[3] > 0;
  let edges = 0;
  let inked = 0;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) {
      if (!opaque(x, y)) continue;
      if (opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1)) continue;
      edges += 1;
      const [r, g, b] = raster.get(x, y);
      if (r === ink[0] && g === ink[1] && b === ink[2]) inked += 1;
    }
  }
  return edges === 0 ? 0 : inked / edges;
}

describe('standing-object outlines', () => {
  const chickenFrames: Array<[string, SpriteGrid]> = Object.entries(CHICKEN_SPRITES)
    .filter(([key]) => key.startsWith('chicken.') && key !== 'chicken.basket')
    .flatMap(([key, entry]) => (entry.frames ?? [entry.grid]).map((grid, i): [string, SpriteGrid] => [`${key}#${i}`, grid]));
  const cases: Array<[string, SpriteGrid]> = [
    ['fence', FENCE],
    ['gate', GATE],
    ['signpost', SIGNPOST],
    ['chicken_shelter', CHICKEN_SPRITES.chicken_shelter.grid],
    ...chickenFrames,
  ];

  it.each(cases)('%s has at least 30%% ink on its edge pixels', (_name, grid) => {
    expect(edgeInkShare(rasterizeGrid(grid))).toBeGreaterThanOrEqual(0.3);
  });
});
