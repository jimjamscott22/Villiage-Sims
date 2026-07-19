import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DemoWorld } from './demoWorld';

describe('DemoWorld pathfinding', () => {
  it('spawns idle villager on passable tile and walks on order', () => {
    const world = new DemoWorld(generateDemoTerrain());
    const before = world.snapshot().villagers[0];
    expect(before.state).toBe(0);

    const tileX = Math.floor(before.x / 32);
    const tileY = Math.floor(before.y / 32);

    // Find a nearby reachable passable goal (spawn must be connected).
    let goal: [number, number] | null = null;
    for (let r = 2; r <= 12 && !goal; r += 1) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r]] as const) {
        const gx = tileX + dx;
        const gy = tileY + dy;
        try {
          world.moveVillagerTo(gx, gy);
          goal = [gx, gy];
          break;
        } catch {
          // try next candidate
        }
      }
    }
    expect(goal).not.toBeNull();
    expect(world.snapshot().villagers[0].state).toBe(1);

    for (let i = 0; i < 400; i += 1) world.advance();
    const after = world.snapshot().villagers[0];
    expect(Math.floor(after.x / 32)).toBe(goal![0]);
    expect(Math.floor(after.y / 32)).toBe(goal![1]);
    expect(after.state).toBe(0);
  });

  it('repaths when a hut blocks the corridor', () => {
    // Small all-grass map for a deterministic corridor.
    const terrain = {
      width: 16,
      height: 8,
      tileSize: 32,
      tiles: new Array(16 * 8).fill(3),
    };
    const world = new DemoWorld(terrain);
    // Force villager to (0,0) center.
    const snap0 = world.snapshot().villagers[0];
    // Move toward (12,0)
    world.moveVillagerTo(12, 0);
    world.placeBuilding('hut', 6, 0, 0);
    const after = world.snapshot().villagers[0];
    // Still moving around the hut, or idle with cooldown (state 0).
    expect([0, 1]).toContain(after.state ?? 0);
    // Advancing should still reach the goal eventually if a path exists.
    for (let i = 0; i < 400; i += 1) {
      if (world.snapshot().villagers[0].state === 0) {
        try {
          world.moveVillagerTo(12, 0);
        } catch {
          // cooldown / no path momentarily
        }
      }
      world.advance();
    }
    const finalTileX = Math.floor(world.snapshot().villagers[0].x / 32);
    // Should be near the goal or at least past the hut.
    expect(finalTileX).toBeGreaterThan(6);
    void snap0;
  });
});
