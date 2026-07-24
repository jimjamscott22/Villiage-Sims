import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DEMO_CATALOG, DemoWorld } from './demoWorld';

function grassTerrain(width = 16, height = 16) {
  return {
    width,
    height,
    tileSize: 32,
    tiles: new Array(width * height).fill(3),
  };
}

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

function inventoryGet(inv: Record<string, number>, key: string): number {
  return inv[key] ?? 0;
}

function inventoryAdd(inv: Record<string, number>, key: string, amount: number): void {
  inv[key] = (inv[key] ?? 0) + amount;
}

function completeBuilding(world: DemoWorld, kind: string, x: number, y: number): number {
  const placed = world.placeBuilding(kind, x, y, 0);
  const building = world.buildings.find((entry) => entry.id === placed.id);
  if (!building) throw new Error(`missing building ${placed.id}`);
  building.complete = true;
  building.progressTicks = DEMO_CATALOG.buildings[building.kindIndex].buildTicks;
  (world as unknown as { advertiseJobsFor(id: number): void }).advertiseJobsFor(placed.id);
  return placed.id;
}

function jobIdFor(world: DemoWorld, site: number, kind: string): number {
  const job = (world as unknown as { jobs: Array<{ id: number; site: number; kind: string }> }).jobs
    .find((entry) => entry.site === site && entry.kind === kind);
  if (!job) throw new Error(`missing ${kind} job for ${site}`);
  return job.id;
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

  it('loads the M8 demo catalog with flour storage and recipes', () => {
    expect(DEMO_CATALOG.buildings).toHaveLength(5);
    expect(DEMO_CATALOG.buildings.find((entry) => entry.id === 'granary')?.stores).toEqual(['grain', 'flour', 'food']);
    expect(DEMO_CATALOG.buildings.find((entry) => entry.id === 'mill')?.recipe).toEqual({
      inputs: { grain: 2 },
      outputs: { flour: 2 },
      ticks: 80,
    });
    expect(DEMO_CATALOG.buildings.find((entry) => entry.id === 'bakery')?.recipe).toEqual({
      inputs: { flour: 1 },
      outputs: { food: 2 },
      ticks: 100,
    });
    expect(new DemoWorld(grassTerrain()).snapshot().resources.flour).toBe(0);
  });

  it('harvests ready wheat into farm inventory without counting it in totals', () => {
    const world = new DemoWorld(grassTerrain());
    const farmId = completeBuilding(world, 'farm', 2, 2);
    world.plantCrop('wheat', 2, 2);
    world.crops[0].stage = 3;

    (world as unknown as { tendHarvestReadyCrop(jobId: number): void }).tendHarvestReadyCrop(
      jobIdFor(world, farmId, 'tend_crops'),
    );

    const farm = world.buildings.find((entry) => entry.id === farmId)!;
    expect(inventoryGet(farm.inventory, 'grain')).toBe(3);
    expect(world.crops).toHaveLength(0);
    expect(world.snapshot().resources.grain).toBe(0);
  });

  it('derives totals from stockpile plus storage inventories only', () => {
    const world = new DemoWorld(grassTerrain());
    const farmId = completeBuilding(world, 'farm', 0, 0);
    const granaryId = completeBuilding(world, 'granary', 4, 0);
    world.resources.grain = 1;
    inventoryAdd(world.buildings.find((entry) => entry.id === farmId)!.inventory, 'grain', 9);
    inventoryAdd(world.buildings.find((entry) => entry.id === granaryId)!.inventory, 'grain', 4);
    inventoryAdd(world.buildings.find((entry) => entry.id === granaryId)!.inventory, 'flour', 2);

    const resources = world.snapshot().resources;

    expect(resources.grain).toBe(5);
    expect(resources.flour).toBe(2);
  });

  it('finds a haul task that moves grain from farm to granary', () => {
    const world = new DemoWorld(grassTerrain());
    const farmId = completeBuilding(world, 'farm', 0, 0);
    const granaryId = completeBuilding(world, 'granary', 4, 0);
    inventoryAdd(world.buildings.find((entry) => entry.id === farmId)!.inventory, 'grain', 6);
    const internals = world as unknown as {
      findHaulTask(): { resource: string; amount: number; from: number | 'stockpile'; to: number | 'stockpile' } | null;
      takeFromEndpoint(endpoint: number | 'stockpile', resource: string, amount: number): number;
      depositToStorage(endpoint: number | 'stockpile', resource: string, amount: number): number;
    };

    const task = internals.findHaulTask();
    expect(task).toEqual({ resource: 'grain', amount: 5, from: farmId, to: granaryId });
    const taken = internals.takeFromEndpoint(task!.from, task!.resource, task!.amount);
    const deposited = internals.depositToStorage(task!.to, task!.resource, taken);

    expect(deposited).toBe(5);
    expect(inventoryGet(world.buildings.find((entry) => entry.id === farmId)!.inventory, 'grain')).toBe(1);
    expect(inventoryGet(world.buildings.find((entry) => entry.id === granaryId)!.inventory, 'grain')).toBe(5);
    expect(world.snapshot().resources.grain).toBe(5);
  });

  it('produces flour in the mill and food in the bakery', () => {
    const world = new DemoWorld(grassTerrain());
    world.resources.wood = 500;
    world.resources.stone = 500;
    const millId = completeBuilding(world, 'mill', 0, 2);
    const bakeryId = completeBuilding(world, 'bakery', 3, 2);
    const internals = world as unknown as { tickProduce(jobId: number): void };

    inventoryAdd(world.buildings.find((entry) => entry.id === millId)!.inventory, 'grain', 2);
    const millJob = jobIdFor(world, millId, 'produce');
    internals.tickProduce(millJob);
    for (let i = 0; i < 80; i += 1) internals.tickProduce(millJob);
    expect(inventoryGet(world.buildings.find((entry) => entry.id === millId)!.inventory, 'grain')).toBe(0);
    expect(inventoryGet(world.buildings.find((entry) => entry.id === millId)!.inventory, 'flour')).toBe(2);

    inventoryAdd(world.buildings.find((entry) => entry.id === bakeryId)!.inventory, 'flour', 1);
    const bakeryJob = jobIdFor(world, bakeryId, 'produce');
    internals.tickProduce(bakeryJob);
    for (let i = 0; i < 100; i += 1) internals.tickProduce(bakeryJob);
    expect(inventoryGet(world.buildings.find((entry) => entry.id === bakeryId)!.inventory, 'flour')).toBe(0);
    expect(inventoryGet(world.buildings.find((entry) => entry.id === bakeryId)!.inventory, 'food')).toBe(2);
  });

  it('gathers wood from a forest node into the stockpile', () => {
    const terrain = grassTerrain(8, 8);
    terrain.tiles[1] = 4;
    const world = new DemoWorld(terrain);
    world.resources.wood = 0;
    const internals = world as unknown as {
      refreshGatherJobs(): void;
      tickGather(jobId: number, ticksRemaining: number): void;
      jobs: Array<{ id: number; kind: string }>;
    };
    internals.refreshGatherJobs();
    const job = internals.jobs.find((entry) => entry.kind === 'gather');

    internals.tickGather(job!.id, 40);

    expect(world.resources.wood).toBe(1);
    expect(world.nodes[0].amount).toBe(4);
  });
});
