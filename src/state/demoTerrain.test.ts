import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DemoWorld } from './demoWorld';

describe('generateDemoTerrain', () => {
  it('creates a full-size island with multiple terrain kinds', () => {
    const terrain = generateDemoTerrain(64, 64, 32, 42);
    expect(terrain.width).toBe(64);
    expect(terrain.height).toBe(64);
    expect(terrain.tiles).toHaveLength(64 * 64);

    const kinds = new Set(terrain.tiles);
    expect([...kinds].some((k) => k <= 1)).toBe(true);
    expect([...kinds].some((k) => k >= 2 && k <= 4)).toBe(true);
    expect([...kinds].some((k) => k >= 5)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    expect(generateDemoTerrain(32, 32, 32, 7).tiles).toEqual(generateDemoTerrain(32, 32, 32, 7).tiles);
  });
});

describe('DemoWorld placement', () => {
  it('places a hut on grass and rejects water', () => {
    const terrain = generateDemoTerrain(32, 32, 32, 42);
    // Force a grass tile and a water tile for deterministic assertions.
    terrain.tiles[10 * 32 + 10] = 3;
    terrain.tiles[0] = 0;
    const world = new DemoWorld(terrain);
    expect(world.validatePlacement('hut', 10, 10, 0).valid).toBe(true);
    world.placeBuilding('hut', 10, 10, 0);
    expect(world.resources.wood).toBe(100);
    expect(world.validatePlacement('hut', 0, 0, 0).valid).toBe(false);
  });

  it('demolishes with a full refund', () => {
    const terrain = generateDemoTerrain(16, 16, 32, 1);
    terrain.tiles.fill(3);
    const world = new DemoWorld(terrain);
    const placed = world.placeBuilding('hut', 2, 2, 0);
    world.demolish(placed.id);
    expect(world.resources.wood).toBe(120);
    expect(world.buildings).toHaveLength(0);
  });
});
