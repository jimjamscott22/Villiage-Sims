import { describe, expect, it } from 'vitest';
import {
  footprintIntersects,
  terrainBlitRect,
  tileInBounds,
  TileSpatialIndex,
  visibleTileBounds,
} from './spatial';

describe('visibleTileBounds', () => {
  it('converts world pixels to inclusive tiles with margin', () => {
    const bounds = visibleTileBounds({ x: 320, y: 640, w: 640, h: 320 }, 32, 2);
    // tiles 10..30 x, 20..30 y before margin
    expect(bounds).toEqual({ minX: 8, minY: 18, maxX: 32, maxY: 32 });
  });
});

describe('tileInBounds / footprintIntersects', () => {
  const bounds = { minX: 2, minY: 2, maxX: 5, maxY: 5 };

  it('includes edge tiles', () => {
    expect(tileInBounds(2, 2, bounds)).toBe(true);
    expect(tileInBounds(5, 5, bounds)).toBe(true);
    expect(tileInBounds(1, 2, bounds)).toBe(false);
  });

  it('detects footprint overlap', () => {
    expect(footprintIntersects(0, 0, 3, 3, bounds)).toBe(true); // covers (0,0)-(2,2)
    expect(footprintIntersects(6, 6, 2, 2, bounds)).toBe(false);
    expect(footprintIntersects(5, 5, 1, 1, bounds)).toBe(true);
  });
});

describe('TileSpatialIndex', () => {
  it('queries only items in range', () => {
    const index = new TileSpatialIndex<{ x: number; y: number; id: string }>(4);
    index.build([
      { x: 1, y: 1, id: 'a' },
      { x: 10, y: 10, id: 'b' },
      { x: 11, y: 10, id: 'c' },
      { x: 50, y: 50, id: 'd' },
    ]);
    const hit = index.query({ minX: 9, minY: 9, maxX: 12, maxY: 12 }).map((p) => p.id);
    expect(hit.sort()).toEqual(['b', 'c']);
    expect(index.size).toBe(4);
  });
});

describe('terrainBlitRect', () => {
  it('clamps to the world layer', () => {
    expect(terrainBlitRect({ x: -10, y: -5, w: 100, h: 50 }, 4096, 4096)).toEqual({
      sx: 0,
      sy: 0,
      sw: 90,
      sh: 45,
    });
  });

  it('returns null when fully outside', () => {
    expect(terrainBlitRect({ x: 5000, y: 0, w: 100, h: 100 }, 4096, 4096)).toBeNull();
  });
});
