import { describe, expect, it } from 'vitest';
import { pack } from './pack';

const square = (key: string, size = 16) => ({ key, width: size, height: size });

describe('pack', () => {
  it('places every item exactly once', () => {
    const items = Array.from({ length: 30 }, (_, i) => square(`t${i}`));
    const { cells } = pack(items, 256);
    expect(cells).toHaveLength(30);
    expect(new Set(cells.map((c) => c.key)).size).toBe(30);
  });

  it('keeps every cell inside the sheet bounds', () => {
    const { cells, height } = pack(Array.from({ length: 40 }, (_, i) => square(`t${i}`)), 128);
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width).toBeLessThanOrEqual(128);
      expect(cell.y + cell.height).toBeLessThanOrEqual(height);
    }
  });

  it('never overlaps two cells', () => {
    const items = [square('a', 48), square('b', 16), square('c', 32), square('d', 16), square('e', 64)];
    const { cells } = pack(items, 96);
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i];
        const b = cells[j];
        const disjoint =
          a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(disjoint).toBe(true);
      }
    }
  });

  it('returns a power-of-two height', () => {
    const { height } = pack(Array.from({ length: 20 }, (_, i) => square(`t${i}`)), 64);
    expect(Number.isInteger(Math.log2(height))).toBe(true);
  });

  it('is deterministic', () => {
    const items = Array.from({ length: 25 }, (_, i) => square(`t${i}`, 16 + (i % 3) * 8));
    expect(pack(items, 128)).toEqual(pack(items, 128));
  });

  it('throws when an item is wider than the sheet', () => {
    expect(() => pack([square('huge', 300)], 256)).toThrow(/wider than the sheet/);
  });
});
