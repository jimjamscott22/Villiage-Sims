import { describe, expect, it } from 'vitest';
import { PALETTE } from '../palette';
import { BASE_TERRAINS, TILE, VARIANTS, makeBaseTile } from './terrain';

const PALETTE_RGB = new Set(
  Object.values(PALETTE).map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(','),
  ),
);

function pixels(raster: { width: number; height: number; get: (x: number, y: number) => number[] }) {
  const out: number[][] = [];
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) out.push(raster.get(x, y));
  }
  return out;
}

describe('makeBaseTile', () => {
  it('produces a 16x16 fully opaque tile', () => {
    const tile = makeBaseTile('grass', 0);
    expect(tile.width).toBe(TILE);
    expect(tile.height).toBe(TILE);
    expect(pixels(tile).every((p) => p[3] === 255)).toBe(true);
  });

  it('uses only palette colors', () => {
    for (const terrain of BASE_TERRAINS) {
      for (let variant = 0; variant < VARIANTS; variant += 1) {
        for (const p of pixels(makeBaseTile(terrain, variant))) {
          expect(PALETTE_RGB.has(`${p[0]},${p[1]},${p[2]}`)).toBe(true);
        }
      }
    }
  });

  it('is deterministic', () => {
    expect(Array.from(makeBaseTile('sand', 2).rgba)).toEqual(Array.from(makeBaseTile('sand', 2).rgba));
  });

  it('produces four distinguishable variants per terrain', () => {
    for (const terrain of BASE_TERRAINS) {
      const seen = new Set<string>();
      for (let variant = 0; variant < VARIANTS; variant += 1) {
        seen.add(Array.from(makeBaseTile(terrain, variant).rgba).join(','));
      }
      expect(seen.size).toBe(VARIANTS);
    }
  });

  it('gives each terrain a visually distinct dominant color', () => {
    const dominants = BASE_TERRAINS.map((terrain) => {
      const counts = new Map<string, number>();
      for (const p of pixels(makeBaseTile(terrain, 0))) {
        const key = `${p[0]},${p[1]},${p[2]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    });
    expect(new Set(dominants).size).toBe(BASE_TERRAINS.length);
  });
});
