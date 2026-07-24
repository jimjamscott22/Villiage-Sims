import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DemoWorld } from './demoWorld';

describe('open spawn pathfinding', () => {
  it('spawns five villagers in open land, walks, and repaths around a hut', () => {
    const terrain = generateDemoTerrain();
    const world = new DemoWorld(terrain);
    const snap = world.snapshot();
    expect(snap.villagers).toHaveLength(5);
    expect(snap.resources.food).toBe(50);

    const v = snap.villagers[0];
    const tx = Math.floor(v.x / terrain.tileSize);
    const ty = Math.floor(v.y / terrain.tileSize);

    const goalX = tx + 10;
    world.moveVillagerTo(goalX, ty);

    let moverId = snap.villagers[0].id;
    let bestDist = Infinity;
    for (const candidate of world.snapshot().villagers) {
      const vx = Math.floor(candidate.x / terrain.tileSize);
      const vy = Math.floor(candidate.y / terrain.tileSize);
      const dist = Math.abs(vx - goalX) + Math.abs(vy - ty);
      if (dist < bestDist) {
        bestDist = dist;
        moverId = candidate.id;
      }
    }
    expect(world.snapshot().villagers.find((entry) => entry.id === moverId)?.state).toBe(1);

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

    let reached = false;
    for (let i = 0; i < 600; i += 1) {
      const s = world.snapshot().villagers.find((entry) => entry.id === moverId)!;
      if (Math.floor(s.x / 32) === goalX && Math.floor(s.y / 32) === ty) {
        reached = true;
        break;
      }
      if (s.state === 0) {
        try {
          world.moveVillagerTo(goalX, ty);
          // Keep following whoever is currently ordered toward the goal.
          let nextId = moverId;
          let nextDist = Infinity;
          for (const candidate of world.snapshot().villagers) {
            const vx = Math.floor(candidate.x / 32);
            const vy = Math.floor(candidate.y / 32);
            const dist = Math.abs(vx - goalX) + Math.abs(vy - ty);
            if (dist < nextDist) {
              nextDist = dist;
              nextId = candidate.id;
            }
          }
          moverId = nextId;
        } catch {
          // cooldown
        }
      }
      world.advance();
    }

    expect(reached).toBe(true);
    expect(world.snapshot().buildings.length).toBe(1);
  });
});
