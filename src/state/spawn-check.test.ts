import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DemoWorld } from './demoWorld';

describe('open spawn pathfinding', () => {
  it('spawns in open land, walks, and repaths around a hut', () => {
    const terrain = generateDemoTerrain();
    const world = new DemoWorld(terrain);
    const v = world.snapshot().villagers[0];
    const tx = Math.floor(v.x / terrain.tileSize);
    const ty = Math.floor(v.y / terrain.tileSize);

    const goalX = tx + 10;
    world.moveVillagerTo(goalX, ty);
    expect(world.snapshot().villagers[0].state).toBe(1);

    let placed = false;
    for (let x = tx + 2; x < goalX; x += 1) {
      if (world.validatePlacement('hut', x, ty, 0).valid) {
        world.placeBuilding('hut', x, ty, 0);
        placed = true;
        break;
      }
      for (const y of [ty - 1, ty + 1, ty]) {
        if (world.validatePlacement('hut', x, y, 0).valid) {
          world.placeBuilding('hut', x, y, 0);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    expect(placed).toBe(true);

    for (let i = 0; i < 600; i += 1) {
      const s = world.snapshot().villagers[0];
      if (s.state === 0 && Math.floor(s.x / 32) !== goalX) {
        try {
          world.moveVillagerTo(goalX, ty);
        } catch {
          // cooldown
        }
      }
      world.advance();
    }

    const end = world.snapshot().villagers[0];
    expect(Math.floor(end.x / 32)).toBe(goalX);
    expect(Math.floor(end.y / 32)).toBe(ty);
    expect(end.state).toBe(0);
    expect(world.snapshot().buildings.length).toBe(1);
  });
});
