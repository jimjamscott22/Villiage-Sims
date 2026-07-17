import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from '../state/transport';

describe('generateDemoTerrain', () => {
  it('creates a full-size island with multiple terrain kinds', () => {
    const terrain = generateDemoTerrain(64, 64, 32, 42);
    expect(terrain.width).toBe(64);
    expect(terrain.height).toBe(64);
    expect(terrain.tiles).toHaveLength(64 * 64);

    const kinds = new Set(terrain.tiles);
    expect([...kinds].some((k) => k <= 1)).toBe(true); // water
    expect([...kinds].some((k) => k >= 2 && k <= 4)).toBe(true); // sand/grass/forest
    expect([...kinds].some((k) => k >= 5)).toBe(true); // rock/mountain
  });

  it('is deterministic for the same seed', () => {
    expect(generateDemoTerrain(32, 32, 32, 7).tiles).toEqual(generateDemoTerrain(32, 32, 32, 7).tiles);
  });
});
