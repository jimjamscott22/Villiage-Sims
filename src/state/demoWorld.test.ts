import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DemoWorld } from './demoWorld';

function nearestVillagerId(world: DemoWorld, x: number, y: number): number {
  const snap = world.snapshot();
  let best = snap.villagers[0];
  let bestDist = Infinity;
  for (const v of snap.villagers) {
    const vx = Math.floor(v.x / 32);
    const vy = Math.floor(v.y / 32);
    const dist = Math.abs(vx - x) + Math.abs(vy - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best.id;
}

function villagerById(world: DemoWorld, id: number) {
  const found = world.snapshot().villagers.find((v) => v.id === id);
  if (!found) throw new Error(`missing villager ${id}`);
  return found;
}

describe('DemoWorld pathfinding', () => {
  it('spawns five idle villagers with starting food and walks on order', () => {
    const world = new DemoWorld(generateDemoTerrain());
    const snap = world.snapshot();
    expect(snap.villagers).toHaveLength(5);
    expect(snap.resources.food).toBe(50);
    expect(snap.villagers.every((v) => v.state === 0)).toBe(true);
    expect(new Set(snap.villagers.map((v) => Math.floor(v.x / 32) + ',' + Math.floor(v.y / 32))).size).toBe(5);

    const before = snap.villagers[0];
    const tileX = Math.floor(before.x / 32);
    const tileY = Math.floor(before.y / 32);

    let goal: [number, number] | null = null;
    let moverId = before.id;
    for (let r = 2; r <= 12 && !goal; r += 1) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r]] as const) {
        const gx = tileX + dx;
        const gy = tileY + dy;
        try {
          world.moveVillagerTo(gx, gy);
          goal = [gx, gy];
          moverId = nearestVillagerId(world, gx, gy);
          break;
        } catch {
          // try next candidate
        }
      }
    }
    expect(goal).not.toBeNull();
    expect(villagerById(world, moverId).state).toBe(1);

    let reached = false;
    for (let i = 0; i < 400; i += 1) {
      world.advance();
      const after = villagerById(world, moverId);
      if (Math.floor(after.x / 32) === goal![0] && Math.floor(after.y / 32) === goal![1]) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
  });

  it('repaths when a hut blocks the corridor', () => {
    const terrain = {
      width: 16,
      height: 8,
      tileSize: 32,
      tiles: new Array(16 * 8).fill(3),
    };
    const world = new DemoWorld(terrain);
    world.moveVillagerTo(12, 0);
    let moverId = nearestVillagerId(world, 12, 0);
    world.placeBuilding('hut', 6, 0, 0);
    const after = villagerById(world, moverId);
    expect([0, 1]).toContain(after.state ?? 0);
    let pastHut = false;
    for (let i = 0; i < 400; i += 1) {
      const current = villagerById(world, moverId);
      if (Math.floor(current.x / 32) > 6) pastHut = true;
      if (current.state === 0) {
        try {
          world.moveVillagerTo(12, 0);
          moverId = nearestVillagerId(world, 12, 0);
        } catch {
          // cooldown / no path momentarily
        }
      }
      world.advance();
    }
    expect(pastHut).toBe(true);
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
    const farmX = Math.min(12, tx + 3);
    const farmY = Math.min(12, ty + 3);
    world.placeBuilding('farm', farmX, farmY, 0);
    for (let i = 0; i < 30; i += 1) world.advance();
    let workingId: number | null = null;
    for (let i = 0; i < 500; i += 1) {
      world.advance();
      const worker = world.snapshot().villagers.find((entry) => entry.state === 2);
      if (worker) {
        workingId = worker.id;
        break;
      }
    }
    expect(workingId).not.toBeNull();
    const detail = world.getVillagerDetail(workingId!);
    expect(detail.jobKind).toBe('tend_crops');
    expect(detail.state).toBe(2);
  });

  it('plants wheat on a completed farm and stalls in winter', () => {
    const terrain = {
      width: 16,
      height: 16,
      tileSize: 32,
      tiles: new Array(16 * 16).fill(3),
    };
    const world = new DemoWorld(terrain);
    world.placeBuilding('farm', 2, 2, 0);
    for (let i = 0; i < 30; i += 1) world.advance();
    world.plantCrop('wheat', 2, 2);
    expect(world.snapshot().crops).toHaveLength(1);
    world.advanceClock(0, 3);
    const crop = world.crops[0];
    crop.watered = true;
    for (let i = 0; i < 500; i += 1) {
      crop.watered = true;
      world.advance();
    }
    expect(world.crops[0].stage).toBe(0);
  });

  it('respects pause speed', () => {
    const world = new DemoWorld(generateDemoTerrain());
    const before = world.snapshot().tick;
    world.setSpeed(0);
    world.advance();
    expect(world.snapshot().tick).toBe(before);
  });

  it('clears eat action after finishing so hysteresis cannot drain food', () => {
    const terrain = {
      width: 16,
      height: 8,
      tileSize: 32,
      tiles: new Array(16 * 8).fill(3),
    };
    const world = new DemoWorld(terrain);
    // Keep a single villager so only one eater can consume stock.
    const internals = world as unknown as {
      villagers: Array<{
        needs: { hunger: number; energy: number; social: number; happiness: number };
        currentAction: string | null;
        state: string;
      }>;
    };
    internals.villagers.splice(1);
    world.resources.food = 3;
    const villager = internals.villagers[0];
    villager.needs.hunger = 0;
    villager.needs.energy = 1;
    villager.needs.social = 1;
    villager.needs.happiness = 1 / 3;

    // Drive one decide+eat cycle via normal ticks.
    let ate = false;
    for (let i = 0; i < 5; i += 1) {
      world.advance();
      if (villager.state === 'eating') {
        ate = true;
        break;
      }
    }
    expect(ate).toBe(true);
    expect(world.resources.food).toBe(2);

    for (let i = 0; i < 80; i += 1) {
      world.advance();
      if (villager.state === 'idle') break;
    }
    expect(villager.state).toBe('idle');
    expect(villager.currentAction).toBeNull();
    expect(villager.needs.hunger).toBe(1);

    const foodAfter = world.resources.food;
    for (let i = 0; i < 40; i += 1) world.advance();
    expect(world.resources.food).toBe(foodAfter);
    expect(villager.state).not.toBe('eating');
  });
});
