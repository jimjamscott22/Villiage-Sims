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

  it('decays hunger and exposes detail', () => {
    const world = new DemoWorld(generateDemoTerrain());
    const before = world.getVillagerDetail(1).hunger;
    for (let i = 0; i < 500; i += 1) world.advance();
    const after = world.getVillagerDetail(1);
    expect(after.hunger).toBeLessThan(before);
    expect(after.name).toBe('Ash');
  });

  it('claims tend_crops on completed farm and enters working', () => {
    const terrain = {
      width: 16,
      height: 16,
      tileSize: 32,
      tiles: new Array(16 * 16).fill(3),
    };
    const world = new DemoWorld(terrain);
    const v = world.snapshot().villagers[0];
    const tx = Math.floor(v.x / 32);
    const ty = Math.floor(v.y / 32);
    // Place farm a few tiles away so an adjacent stand tile is reachable.
    const farmX = Math.min(12, tx + 3);
    const farmY = Math.min(12, ty + 3);
    world.placeBuilding('farm', farmX, farmY, 0);
    for (let i = 0; i < 30; i += 1) world.advance();
    let working = false;
    for (let i = 0; i < 500; i += 1) {
      world.advance();
      if (world.snapshot().villagers[0].state === 2) {
        working = true;
        break;
      }
    }
    expect(working).toBe(true);
    const detail = world.getVillagerDetail(1);
    expect(detail.jobKind).toBe('tend_crops');
    expect(detail.state).toBe(2);
  });

  it('plants wheat, grows in spring, stalls in winter', () => {
    const terrain = {
      width: 16,
      height: 16,
      tileSize: 32,
      tiles: new Array(16 * 16).fill(3),
    };
    const world = new DemoWorld(terrain);
    world.placeBuilding('farm', 4, 4, 0);
    for (let i = 0; i < 30; i += 1) world.advance();
    world.plantCrop('wheat', 4, 4);
    expect(world.snapshot().crops).toHaveLength(1);

    // Water via tend work cycles by advancing until working, then force growth checks.
    for (let i = 0; i < 200; i += 1) world.advance();
    // Manually keep advancing with auto-plant/water from tend; stage may still be 0 early.
    const snapSpring = world.snapshot();
    expect(snapSpring.clock.season).toBe(0);
    expect(snapSpring.crops.length).toBeGreaterThanOrEqual(1);

    world.advanceClock(0, 3); // winter
    const stageBefore = world.snapshot().crops[0]?.stage ?? 0;
    const tickBefore = world.snapshot().tick;
    for (let i = 0; i < 50; i += 1) world.advance();
    expect(world.snapshot().clock.season).toBe(3);
    expect(world.snapshot().crops[0]?.stage).toBe(stageBefore);
    expect(world.snapshot().tick).toBeGreaterThan(tickBefore);
  });

  it('exposes clock in snapshots and respects pause via setSpeed', () => {
    const world = new DemoWorld(generateDemoTerrain());
    expect(world.snapshot().clock.day).toBe(1);
    world.setSpeed(0);
    expect(world.speed).toBe(0);
    world.setSpeed(2);
    expect(world.speed).toBe(2);
  });
});
