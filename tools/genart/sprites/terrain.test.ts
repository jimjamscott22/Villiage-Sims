import { describe, expect, it } from 'vitest';
import { PALETTE } from '../palette';
import {
  BASE_TERRAINS,
  EDGES,
  FOAM_EDGES,
  FOAM_FRAMES,
  TILE,
  VARIANTS,
  makeBaseTile,
  makeFoam,
  makeFringe,
} from './terrain';

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

function opaqueCount(raster: ReturnType<typeof makeFringe>): number {
  let count = 0;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) if (raster.get(x, y)[3] === 255) count += 1;
  }
  return count;
}

function rowHasPixels(raster: ReturnType<typeof makeFringe>, y: number): boolean {
  for (let x = 0; x < raster.width; x += 1) if (raster.get(x, y)[3] === 255) return true;
  return false;
}

function columnHasPixels(raster: ReturnType<typeof makeFringe>, x: number): boolean {
  for (let y = 0; y < raster.height; y += 1) if (raster.get(x, y)[3] === 255) return true;
  return false;
}

describe('EDGES', () => {
  it('covers four sides, four outer corners and four inner corners', () => {
    expect(EDGES).toHaveLength(12);
    expect(new Set(EDGES).size).toBe(12);
  });
});

describe('makeFringe', () => {
  it('leaves most of the tile transparent', () => {
    const fringe = makeFringe('grass', 'n');
    expect(opaqueCount(fringe)).toBeGreaterThan(0);
    expect(opaqueCount(fringe)).toBeLessThan(TILE * TILE * 0.5);
  });

  it('puts a north fringe against the top edge and nowhere near the bottom', () => {
    const fringe = makeFringe('grass', 'n');
    expect(rowHasPixels(fringe, 0)).toBe(true);
    expect(rowHasPixels(fringe, TILE - 1)).toBe(false);
  });

  it('puts a west fringe against the left edge and nowhere near the right', () => {
    const fringe = makeFringe('sand', 'w');
    expect(columnHasPixels(fringe, 0)).toBe(true);
    expect(columnHasPixels(fringe, TILE - 1)).toBe(false);
  });

  it('makes outer corners larger than inner corners', () => {
    expect(opaqueCount(makeFringe('rock', 'nwOut'))).toBeGreaterThan(
      opaqueCount(makeFringe('rock', 'nwIn')),
    );
  });

  it('is deterministic across every terrain and edge', () => {
    for (const terrain of BASE_TERRAINS) {
      for (const edge of EDGES) {
        expect(Array.from(makeFringe(terrain, edge).rgba)).toEqual(
          Array.from(makeFringe(terrain, edge).rgba),
        );
      }
    }
  });

  it('uses only palette colors', () => {
    for (const p of pixels(makeFringe('grass', 'nwOut'))) {
      if (p[3] === 0) continue;
      expect(PALETTE_RGB.has(`${p[0]},${p[1]},${p[2]}`)).toBe(true);
    }
  });
});

describe('makeFoam', () => {
  it('only covers side and outer-corner edges', () => {
    expect(FOAM_EDGES).toHaveLength(8);
    expect(FOAM_EDGES.every((edge) => !edge.endsWith('In'))).toBe(true);
  });

  it('differs between frames so the shoreline shimmers', () => {
    const seen = new Set<string>();
    for (let frame = 0; frame < FOAM_FRAMES; frame += 1) {
      seen.add(Array.from(makeFoam('n', frame).rgba).join(','));
    }
    expect(seen.size).toBe(FOAM_FRAMES);
  });

  it('is thinner than the matching fringe', () => {
    expect(opaqueCount(makeFoam('n', 0))).toBeLessThan(opaqueCount(makeFringe('sand', 'n')));
  });

  it('is deterministic', () => {
    expect(Array.from(makeFoam('e', 1).rgba)).toEqual(Array.from(makeFoam('e', 1).rgba));
  });
});
