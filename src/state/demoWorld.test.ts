import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DEMO_CATALOG, DemoWorld, demoWeatherFor, type DemoVillager } from './demoWorld';

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
    world.resources.grain = 4;
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
    expect(DEMO_CATALOG.buildings).toHaveLength(10);
    // Building kind is an index into this list, so new entries must be appended.
    // This must stay in lockstep with src-tauri/data/buildings.json.
    expect(DEMO_CATALOG.buildings.map((entry) => entry.id)).toEqual([
      'hut',
      'farm',
      'granary',
      'mill',
      'bakery',
      'well',
      'fence',
      'gate',
      'signpost',
      'storehouse',
    ]);
    expect(DEMO_CATALOG.buildings.find((entry) => entry.id === 'storehouse')?.stores).toEqual(['wood', 'stone']);
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
      findHaulTask(from: [number, number]): { resource: string; amount: number; from: number | 'stockpile'; to: number | 'stockpile' } | null;
      takeFromEndpoint(endpoint: number | 'stockpile', resource: string, amount: number): number;
      depositToStorage(endpoint: number | 'stockpile', resource: string, amount: number): number;
    };

    const task = internals.findHaulTask([3, 3]);
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

  it('advertises reachable gather work for both wood and stone', () => {
    const terrain = grassTerrain(12, 12);
    const world = new DemoWorld(terrain);
    world.nodes = [
      ...Array.from({ length: 6 }, (_, i) => ({
        tile: [i + 1, 1] as [number, number],
        resource: 'wood' as const,
        amount: 5,
        max: 5,
        regenAcc: 0,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        tile: [i + 1, 9] as [number, number],
        resource: 'stone' as const,
        amount: 4,
        max: 4,
        regenAcc: 0,
      })),
    ];
    const internals = world as unknown as {
      refreshGatherJobs(): void;
      jobs: Array<{ kind: string; gatherTile?: [number, number] }>;
    };

    internals.refreshGatherJobs();

    const resources = internals.jobs
      .filter((job) => job.kind === 'gather')
      .map((job) => world.nodes.find((node) =>
        node.tile[0] === job.gatherTile?.[0] && node.tile[1] === job.gatherTile?.[1])?.resource);
    expect(resources.filter((resource) => resource === 'wood')).toHaveLength(3);
    expect(resources.filter((resource) => resource === 'stone')).toHaveLength(3);
  });

  it('skips an unreachable preferred job and claims reachable work', () => {
    const terrain = grassTerrain(8, 8);
    for (let y = 0; y < terrain.height; y += 1) terrain.tiles[y * terrain.width + 3] = 0;
    const world = new DemoWorld(terrain);
    const internals = world as unknown as {
      villagers: Array<{
        id: number;
        x: number;
        y: number;
        state: string;
        currentJob: number | null;
        currentAction: string | null;
        repathCooldown: number;
      }>;
      jobs: Array<{
        id: number;
        kind: string;
        site: number;
        tile: [number, number];
        priority: number;
        claimedBy: number | null;
        gatherTile?: [number, number];
      }>;
      beginWork(index: number, jobId: number | null): void;
    };
    internals.villagers.splice(1);
    Object.assign(internals.villagers[0], {
      x: 16,
      y: 16,
      state: 'idle',
      currentJob: null,
      currentAction: null,
      repathCooldown: 0,
    });
    world.nodes = [
      { tile: [4, 0], resource: 'wood', amount: 5, max: 5, regenAcc: 0 },
      { tile: [0, 4], resource: 'stone', amount: 4, max: 4, regenAcc: 0 },
    ];
    internals.jobs = [
      {
        id: 1,
        kind: 'gather',
        site: 0,
        tile: [4, 0],
        priority: 10,
        claimedBy: null,
        gatherTile: [4, 0],
      },
      {
        id: 2,
        kind: 'gather',
        site: 0,
        tile: [0, 4],
        priority: 8,
        claimedBy: null,
        gatherTile: [0, 4],
      },
    ];

    internals.beginWork(0, 1);

    expect(internals.villagers[0].currentJob).toBe(2);
    expect(internals.jobs[0].claimedBy).toBeNull();
    expect(internals.jobs[1].claimedBy).toBe(internals.villagers[0].id);
  });

  it('runs the farm to bakery chain without manual job assignment', () => {
    const world = new DemoWorld(grassTerrain(24, 24));
    (world as unknown as { villagers: unknown[] }).villagers.splice(1);
    world.resources.wood = 500;
    world.resources.stone = 500;
    world.resources.grain = 4;
    completeBuilding(world, 'farm', 7, 7);
    completeBuilding(world, 'granary', 12, 7);
    completeBuilding(world, 'mill', 12, 11);
    completeBuilding(world, 'bakery', 8, 12);
    let sawGrain = false;
    let sawFlour = false;
    let sawBakeryFood = false;

    for (let i = 0; i < 20_000; i += 1) {
      world.advance();
      sawGrain ||= world.buildings.some((building) => inventoryGet(building.inventory, 'grain') > 0);
      sawFlour ||= world.buildings.some((building) => inventoryGet(building.inventory, 'flour') > 0);
      const bakery = world.buildings.find(
        (building) => DEMO_CATALOG.buildings[building.kindIndex].id === 'bakery',
      );
      sawBakeryFood ||= bakery != null && inventoryGet(bakery.inventory, 'food') > 0;
      if (sawGrain && sawFlour && sawBakeryFood) break;
    }

    expect(sawGrain).toBe(true);
    expect(sawFlour).toBe(true);
    expect(sawBakeryFood).toBe(true);
  });
  it('tracks housing capacity, villager traits, and unlock conditions', () => {
    const world = new DemoWorld(grassTerrain(16, 16));
    const snap = world.snapshot();
    expect(snap.housingCapacity).toBe(5);

    const detail = world.getVillagerDetail(snap.villagers[0].id);
    expect(detail.traits.length).toBeGreaterThan(0);

    completeBuilding(world, 'hut', 4, 4);
    expect(world.snapshot().housingCapacity).toBe(7);
  });

  it('round-trips the complete browser demo state', () => {
    const world = new DemoWorld(grassTerrain(16, 16));
    const hut = world.placeBuilding('hut', 4, 4, 0);
    for (let i = 0; i < 75; i += 1) world.advance();
    const saved = world.exportState();

    world.demolish(hut.id);
    world.advance();
    const loaded = DemoWorld.importState(saved);

    expect(loaded.exportState()).toBe(saved);
    expect(loaded.snapshot()).toEqual(DemoWorld.importState(saved).snapshot());
    expect(loaded.worldInit()).toMatchObject({
      seed: 42,
      width: 16,
      height: 16,
      tick: 75,
      saveVersion: 3,
    });
  });

  it('rejects unsupported browser save versions', () => {
    const state = JSON.parse(new DemoWorld(grassTerrain()).exportState()) as Record<string, unknown>;
    state.version = 99;
    expect(() => DemoWorld.importState(JSON.stringify(state))).toThrow(
      'unsupported save version 99 (expected 3)',
    );
  });

  it('exposes deterministic weather and rotates autosaves on day rollover', () => {
    const saves = new Map<number, string>();
    const world = new DemoWorld(grassTerrain(16, 16));
    world.bindAutosave(saves);

    expect(world.snapshot().clock.weather).toBe(
      demoWeatherFor(42, 1, 0, 1),
    );

    world.advanceClock(1, null);
    expect(world.snapshot().lastAutosaveSlot).toBe(2);
    expect(saves.has(2)).toBe(true);

    world.advanceClock(1, null);
    expect(world.snapshot().lastAutosaveSlot).toBe(3);
    expect(saves.has(3)).toBe(true);

    world.advanceClock(1, null);
    expect(world.snapshot().lastAutosaveSlot).toBe(1);
    expect(saves.has(1)).toBe(true);
  });

  it('picks auto-plant crops by season and seed cost, matching the Rust sim', () => {
    const world = new DemoWorld(grassTerrain());
    const farmId = completeBuilding(world, 'farm', 2, 2);
    const internals = world as unknown as { autoPlantCandidates(farmId: number): number[] };
    const ids = () => internals.autoPlantCandidates(farmId).map((index) => world.catalog.crops[index].id);

    world.resources.grain = 0;
    world.resources.food = 50;
    world.advanceClock(0, 0);
    expect(ids()).toEqual(['peas']);

    world.resources.grain = 4;
    expect(ids()).toEqual(['wheat', 'peas']);

    world.advanceClock(0, 1);
    expect(ids()).toEqual(['wheat', 'strawberry']);

    world.advanceClock(0, 3);
    expect(ids()).toEqual(['carrot']);

    world.resources.food = 0;
    expect(ids()).toEqual([]);
  });

  it('does not auto-plant when no seed cost can be paid', () => {
    const world = new DemoWorld(grassTerrain());
    expect(world.resources.grain).toBe(0);
    world.resources.food = 0; // food pays for the vegetable seeds
    const farmId = completeBuilding(world, 'farm', 2, 2);
    const internals = world as unknown as {
      farmNeedsTending(buildingId: number): boolean;
      villagers: Array<{ currentJob: number | null }>;
      jobs: Array<{ id: number; kind: string }>;
    };
    expect(internals.farmNeedsTending(farmId)).toBe(false);
    for (let i = 0; i < 500; i += 1) {
      world.advance();
      for (const villager of internals.villagers) {
        if (villager.currentJob == null) continue;
        const job = internals.jobs.find((entry) => entry.id === villager.currentJob);
        expect(job?.kind).not.toBe('tend_crops');
      }
    }
    expect(world.crops).toHaveLength(0);
  });

  it('keeps unlocks after a prerequisite condition lapses', () => {
    const world = new DemoWorld(grassTerrain(16, 16));
    const internals = world as unknown as { villagers: unknown[]; unlocked: string[] };
    // Seed at population 4 so granary starts locked, then cross the threshold.
    internals.villagers.splice(4);
    internals.unlocked = (world as unknown as { satisfiedUnlocks(): string[] }).satisfiedUnlocks();
    expect(world.snapshot().unlocked).not.toContain('granary');

    const clone = structuredClone(internals.villagers[0]) as { id: number };
    clone.id = 9999;
    internals.villagers.push(clone);
    world.advance();
    expect(world.snapshot().unlocked).toContain('granary');

    internals.villagers.splice(4);
    world.advance();
    expect(world.snapshot().unlocked).toContain('granary');
  });

  it('deposits carried goods when the player issues a move order', () => {
    const world = new DemoWorld(grassTerrain());
    const id = nearestVillagerId(world, 6, 6);
    const villagers = (world as unknown as {
      villagers: Array<{ id: number; carrying: { resource: string; amount: number; dest: 'stockpile' } | null }>;
    }).villagers;
    const villager = villagers.find((entry) => entry.id === id)!;
    villager.carrying = { resource: 'grain', amount: 3, dest: 'stockpile' };
    world.moveVillagerTo(6, 6, id);
    expect(villager.carrying).toBeNull();
    expect(world.resources.grain).toBe(3);
  });

  it('moves the requested villager when an id is provided', () => {
    const world = new DemoWorld(grassTerrain());
    const [a, b] = world.snapshot().villagers;
    world.moveVillagerTo(6, 6, b.id);
    const snap = world.snapshot();
    expect(snap.villagers.find((entry) => entry.id === b.id)?.state).toBe(1);
    expect(snap.villagers.find((entry) => entry.id === a.id)?.state).not.toBe(1);
  });

  it('exposes MovingTo destination and purpose on the snapshot', () => {
    const world = new DemoWorld(grassTerrain());
    const id = nearestVillagerId(world, 0, 0);
    world.moveVillagerTo(6, 6, id);
    const view = villagerById(world, id);
    expect(view.state).toBe(1);
    expect(view.destination).toEqual([6, 6]);
    expect(view.purpose).toBe(0); // player order
  });

  it('falls back when a stale villager id is requested', () => {
    const world = new DemoWorld(grassTerrain());
    expect(() => world.moveVillagerTo(6, 6, 9999)).not.toThrow();
    expect(world.snapshot().villagers.some((entry) => entry.state === 1)).toBe(true);
  });
});


describe('simulation review regressions', () => {
  it('interrupts a starving worker trip to eat while keeping the job claim', () => {
    const world = new DemoWorld(grassTerrain(64, 64));
    const internals = world as unknown as {
      villagers: Array<{ id: number; x: number; y: number; needs: { hunger: number }; currentJob: number | null; state: string }>;
      jobs: Array<{ id: number; claimedBy: number | null }>;
    };
    internals.villagers.splice(1);
    Object.assign(internals.villagers[0], { x: 16, y: 16 });
    internals.villagers[0].needs.hunger = 0.001;
    world.resources.food = 0;
    world.nodes = [{ tile: [60, 0], resource: 'wood', amount: 5, max: 5, regenAcc: 0 }];
    world.advance();
    const job = internals.villagers[0].currentJob;
    expect(job).not.toBeNull();
    expect(internals.villagers[0].state).toBe('moving');
    world.resources.food = 10;

    for (let i = 0; i < 80; i += 1) world.advance();

    expect(internals.villagers[0].needs.hunger).toBeGreaterThan(0.99);
    expect(world.resources.food).toBe(9);
    expect(internals.villagers[0].currentJob).toBe(job);
    expect(internals.jobs.find((j) => j.id === job)?.claimedBy).toBe(internals.villagers[0].id);
  });

  it('supplies an accessible bakery despite an enclosed farm pickup', () => {
    const terrain = grassTerrain(24, 24);
    const world = new DemoWorld(terrain);
    const simulation = world as unknown as { villagers: Array<unknown> };
    simulation.villagers.splice(1);
    world.resources.wood = 1000;
    world.resources.stone = 1000;
    world.resources.grain = 0;
    world.resources.flour = 10;
    world.resources.food = 0;
    const farm = completeBuilding(world, 'farm', 3, 3);
    completeBuilding(world, 'granary', 10, 5);
    const bakery = completeBuilding(world, 'bakery', 14, 9);
    inventoryAdd(world.buildings.find((b) => b.id === farm)!.inventory, 'grain', 5);
    for (let y = 1; y <= 7; y += 1) {
      for (let x = 1; x <= 7; x += 1) {
        if (x === 1 || x === 7 || y === 1 || y === 7) terrain.tiles[y * 24 + x] = 5; // rock
      }
    }
    const internals = world as unknown as {
      findHaulTask(from: [number, number]): { from: number | 'stockpile'; to: number | 'stockpile'; resource: string };
    };
    expect(internals.findHaulTask([0, 0])).toMatchObject({ from: 'stockpile', to: bakery, resource: 'flour' });
    for (let i = 0; i < 1500 && world.resources.food === 0; i += 1) world.advance();
    expect(world.snapshot().resources.food).toBeGreaterThan(0);
    expect(world.buildings.find((b) => b.id === farm)!.inventory.grain).toBe(5);
  });

  it('skips unreachable delivery destinations and storage sources', () => {
    const terrain = grassTerrain(24, 24);
    const world = new DemoWorld(terrain);
    world.resources.wood = 1000;
    world.resources.stone = 1000;
    const blocked = completeBuilding(world, 'granary', 3, 3);
    const reachable = completeBuilding(world, 'granary', 14, 3);
    const bakery = completeBuilding(world, 'bakery', 14, 9);
    inventoryAdd(world.buildings.find((b) => b.id === blocked)!.inventory, 'flour', 4);
    inventoryAdd(world.buildings.find((b) => b.id === reachable)!.inventory, 'flour', 3);
    for (let y = 1; y <= 6; y += 1) {
      for (let x = 1; x <= 6; x += 1) {
        if (x === 1 || x === 6 || y === 1 || y === 6) terrain.tiles[y * 24 + x] = 5; // rock
      }
    }
    const internals = world as unknown as {
      findHaulTask(from: [number, number]): { from: number | 'stockpile'; to: number | 'stockpile'; resource: string };
    };
    expect(internals.findHaulTask([0, 0])).toMatchObject({ from: reachable, to: bakery, resource: 'flour' });
    world.buildings.find((b) => b.id === reachable)!.inventory = {};
    world.buildings.find((b) => b.id === blocked)!.inventory = {};
    const farm = completeBuilding(world, 'farm', 8, 2);
    inventoryAdd(world.buildings.find((b) => b.id === farm)!.inventory, 'grain', 5);
    expect(internals.findHaulTask([8, 0])).toMatchObject({ from: farm, to: reachable, resource: 'grain' });
  });
  it('releases a stale farm claim when selecting other work so another villager can take it', () => {
    const world = new DemoWorld(grassTerrain(24, 24));
    const internals = world as unknown as {
      villagers: DemoVillager[];
      crops: Array<{ watered: boolean }>;
      jobs: Array<{ id: number; kind: string; site: number; claimedBy: number | null }>;
      farmFootprintTiles(site: number): Array<[number, number]>;
      maybeDecide(index: number): void;
      beginWork(index: number, jobId: number): void;
    };
    world.resources.grain = 20;
    const farm = completeBuilding(world, 'farm', 8, 8);
    const otherFarm = completeBuilding(world, 'farm', 14, 14);
    for (const [x, y] of internals.farmFootprintTiles(farm)) world.plantCrop('wheat', x, y);
    for (const crop of internals.crops) crop.watered = true;
    const stale = internals.jobs.find((job) => job.site === farm && job.kind === 'tend_crops')!;
    const worker = internals.villagers[0];
    stale.claimedBy = worker.id;
    Object.assign(worker, {
      x: 16, y: 16, state: 'idle', currentJob: stale.id, currentAction: 'work',
    });

    internals.maybeDecide(0);

    const selected = internals.jobs.find((job) => job.id === worker.currentJob)!;
    expect(selected.site).toBe(otherFarm);
    expect(selected.claimedBy).toBe(worker.id);
    expect(stale.claimedBy).toBeNull();
    expect(internals.jobs.filter((job) => job.claimedBy === worker.id)).toHaveLength(1);

    // Make the previous farm actionable again: its original slot must be available.
    internals.crops[0].watered = false;
    internals.beginWork(1, stale.id);
    expect(internals.villagers[1].currentJob).toBe(stale.id);
    expect(stale.claimedBy).toBe(internals.villagers[1].id);
    expect(selected.claimedBy).toBe(worker.id);
    internals.beginWork(0, selected.id);
    expect(selected.claimedBy).toBe(worker.id);
    expect(internals.jobs.filter((job) => job.claimedBy === worker.id)).toHaveLength(1);
  });

  it('resumes cargo delivery when the original haul job tile is unreachable', () => {
    const terrain = grassTerrain(24, 24);
    const world = new DemoWorld(terrain);
    const internals = world as unknown as {
      villagers: DemoVillager[];
      jobs: Array<{ id: number; kind: string; site: number; claimedBy: number | null }>;
      beginWork(index: number, jobId: number): void;
    };
    const blocked = completeBuilding(world, 'granary', 3, 3);
    const reachable = completeBuilding(world, 'granary', 14, 3);
    for (let y = 1; y <= 6; y += 1) {
      for (let x = 1; x <= 6; x += 1) {
        if (x === 1 || x === 6 || y === 1 || y === 6) terrain.tiles[y * 24 + x] = 5;
      }
    }
    const previous = internals.jobs.find((job) => job.site === blocked && job.kind === 'haul')!;
    const next = internals.jobs.find((job) => job.site === reachable && job.kind === 'haul')!;
    const worker = internals.villagers[0];
    previous.claimedBy = worker.id;
    const cargo = { resource: 'grain', amount: 3, dest: reachable };
    Object.assign(worker, {
      x: 16, y: 16, state: 'idle', currentJob: previous.id, carrying: cargo,
    });
    const grainBefore = world.resources.grain;

    internals.beginWork(0, next.id);

    expect(previous.claimedBy).toBe(worker.id);
    expect(next.claimedBy).toBeNull();
    expect(worker.currentJob).toBe(previous.id);
    expect(worker.carrying).toEqual(cargo);
    expect(world.resources.grain).toBe(grainBefore);
  });

  it.each([false, true])('returns cargo when delivery is unreachable (existing claim: %s)', (claimed) => {
    const terrain = grassTerrain(24, 24);
    const world = new DemoWorld(terrain);
    const internals = world as unknown as {
      villagers: DemoVillager[];
      jobs: Array<{ id: number; kind: string; site: number; claimedBy: number | null }>;
      beginWork(index: number, jobId: number): void;
    };
    const granary = completeBuilding(world, 'granary', 3, 3);
    for (let y = 1; y <= 6; y += 1) {
      for (let x = 1; x <= 6; x += 1) {
        if (x === 1 || x === 6 || y === 1 || y === 6) terrain.tiles[y * 24 + x] = 5;
      }
    }
    const haul = internals.jobs.find((job) => job.site === granary && job.kind === 'haul')!;
    const worker = internals.villagers[0];
    haul.claimedBy = claimed ? worker.id : null;
    Object.assign(worker, {
      x: 16, y: 16, state: 'idle', currentJob: claimed ? haul.id : null,
      carrying: { resource: 'grain', amount: 3, dest: granary },
    });
    const before = world.resources.grain;

    internals.beginWork(0, haul.id);

    expect(worker.currentJob).toBeNull();
    expect(haul.claimedBy).toBeNull();
    expect(worker.carrying).toBeNull();
    expect(world.resources.grain).toBe(before + 3);
    internals.beginWork(0, haul.id);
    expect(world.resources.grain).toBe(before + 3);
  });

  it('releases a blocked producer so the only worker can haul and finish the pending batch', () => {
    const world = new DemoWorld(grassTerrain(16, 16));
    const internals = world as unknown as {
      villagers: DemoVillager[];
      jobs: Array<{ id: number; kind: string; site: number; claimedBy: number | null }>;
      buildingStandTile(site: number): [number, number];
      jobActionable(job: unknown, index: number): boolean;
      tickVillagerAt(index: number): void;
    };
    internals.villagers.splice(1);
    const bakery = completeBuilding(world, 'bakery', 4, 4);
    const building = world.buildings.find((entry) => entry.id === bakery)!;
    const produce = internals.jobs.find((job) => job.site === bakery && job.kind === 'produce')!;
    const haul = internals.jobs.find((job) => job.site === bakery && job.kind === 'haul')!;
    building.inventory.food = 30;
    building.recipeTicks = 2;
    expect(internals.jobActionable(produce, 0)).toBe(true);
    building.recipeTicks = 1;
    expect(internals.jobActionable(produce, 0)).toBe(false);
    building.inventory.food = 29;
    expect(internals.jobActionable(produce, 0)).toBe(false);
    building.inventory.food = 28;
    expect(internals.jobActionable(produce, 0)).toBe(true);
    building.inventory.food = 30;
    const worker = internals.villagers[0];
    const [x, y] = internals.buildingStandTile(bakery);
    produce.claimedBy = worker.id;
    Object.assign(worker, {
      x: x * 32 + 16, y: y * 32 + 16, state: 'working',
      currentJob: produce.id, currentAction: 'work', workTicksRemaining: 40,
    });

    internals.tickVillagerAt(0);

    expect(worker.currentJob).toBeNull();
    expect(produce.claimedBy).toBeNull();
    expect(building.recipeTicks).toBe(1);
    const before = world.resources.food;
    let hauled = false;
    for (let i = 0; i < 2000 && building.recipeTicks !== 0; i += 1) {
      internals.tickVillagerAt(0);
      hauled ||= worker.currentJob === haul.id;
    }
    expect(hauled).toBe(true);
    expect(building.recipeTicks).toBe(0);
    const carried = worker.carrying?.resource === 'food' ? worker.carrying.amount : 0;
    expect(world.resources.food + (building.inventory.food ?? 0) + carried).toBe(before + 32);
    expect(internals.villagers).toHaveLength(1);
  });

  it('repaths when a new building blocks a flank of a diagonal step', () => {
    const world = new DemoWorld(grassTerrain());
    const internals = world as unknown as {
      villagers: Array<{ id: number; x: number; y: number; path: Array<[number, number]> | null }>;
      invalidatePathsIfNeeded(): void;
    };
    const villager = internals.villagers[0];
    const tile = 32;
    villager.x = tile / 2;
    villager.y = tile / 2;
    world.moveVillagerTo(1, 1, villager.id);
    expect(villager.path).toEqual([[1, 1]]);
    completeBuilding(world, 'fence', 1, 0);
    internals.invalidatePathsIfNeeded();
    expect(villager.path).not.toEqual([[1, 1]]);
  });
  it('returns carried cargo when the hauled site is demolished', () => {
    const world = new DemoWorld(grassTerrain(32, 32));
    const internals = world as unknown as {
      villagers: Array<{
        id: number;
        currentJob: number | null;
        carrying: { resource: string; amount: number; dest: unknown } | null;
      }>;
      jobs: Array<{ id: number; kind: string; site: number; claimedBy: number | null }>;
    };
    const granary = completeBuilding(world, 'granary', 20, 20);
    completeBuilding(world, 'farm', 2, 2);
    const haul = internals.jobs.find((job) => job.kind === 'haul')!;
    const villager = internals.villagers[0];
    villager.currentJob = haul.id;
    haul.claimedBy = villager.id;
    villager.carrying = { resource: 'grain', amount: 3, dest: { building: granary } };
    const grainBefore = world.resources.grain;
    world.demolish(haul.site);
    expect(villager.currentJob).toBeNull();
    expect(villager.carrying).toBeNull();
    expect(world.resources.grain).toBeGreaterThanOrEqual(grainBefore + 3);
  });
  it.each(['working', 'moving', 'eating'] as const)(
    'returns cargo exactly once when a storm removes a %s hauler claim',
    (state) => {
      const world = new DemoWorld(grassTerrain(32, 32));
      const internals = world as unknown as {
        villagers: DemoVillager[];
        jobs: Array<{ id: number; kind: string; site: number; claimedBy: number | null }>;
        clock: { day: number };
        applyDailyWeather(): void;
      };
      const granary = completeBuilding(world, 'granary', 20, 20);
      const otherGranary = completeBuilding(world, 'granary', 6, 6);
      const haul = internals.jobs.find((job) => job.site === granary && job.kind === 'haul')!;
      const otherHaul = internals.jobs.find((job) => job.site === otherGranary && job.kind === 'haul')!;
      const villager = internals.villagers[0];
      const otherVillager = internals.villagers[1];
      haul.claimedBy = villager.id;
      Object.assign(villager, {
        currentJob: haul.id,
        carrying: { resource: 'grain', amount: 3, dest: granary },
        state,
        currentAction: state === 'eating' ? 'eat' : 'work',
        purpose: state === 'moving' ? 'work' : null,
        target: state === 'moving' ? [19, 20] : null,
        path: state === 'moving' ? [[19, 20]] : null,
        activityTicks: 20,
      });
      otherHaul.claimedBy = otherVillager.id;
      Object.assign(otherVillager, {
        currentJob: otherHaul.id,
        carrying: { resource: 'flour', amount: 4, dest: otherGranary },
        state: 'moving',
        currentAction: 'work',
        purpose: 'work',
        target: [5, 6],
        path: [[5, 6]],
      });
      const otherBefore = structuredClone(otherVillager);
      const grainBefore = world.resources.grain;
      const flourBefore = world.resources.flour;

      // Seed 42, spring day 16 is a storm that damages the first of two buildings.
      internals.clock.day = 15;
      world.advanceClock(1, null);

      expect(world.snapshot().clock).toMatchObject({ day: 16, weather: 2 });
      expect(world.buildings.find((building) => building.id === granary)).toMatchObject({
        complete: false,
        progressTicks: DEMO_CATALOG.buildings.find((def) => def.id === 'granary')!.buildTicks / 2,
      });
      expect(world.buildings.find((building) => building.id === otherGranary)?.complete).toBe(true);
      expect(internals.jobs.some((job) => job.site === granary)).toBe(false);
      expect(villager.currentJob).toBeNull();
      expect(villager.carrying).toBeNull();
      expect(world.resources.grain).toBe(grainBefore + 3);
      expect(world.resources.flour).toBe(flourBefore);
      expect(villager).toMatchObject({
        state: state === 'eating' ? 'eating' : 'idle',
        currentAction: state === 'eating' ? 'eat' : null,
        purpose: null,
        target: null,
        path: null,
        activityTicks: 20,
      });
      expect(otherVillager).toEqual(otherBefore);
      expect(otherHaul.claimedBy).toBe(otherVillager.id);

      // Reapplying weather on the same date cannot deposit the abandoned cargo twice.
      internals.applyDailyWeather();
      expect(villager.currentJob).toBeNull();
      expect(villager.carrying).toBeNull();
      expect(world.resources.grain).toBe(grainBefore + 3);
      expect(world.resources.flour).toBe(flourBefore);
      expect(otherVillager).toEqual(otherBefore);
      expect(otherHaul.claimedBy).toBe(otherVillager.id);
    },
  );

  it('ends a worked-in-place job when a building covers the worker tile', () => {
    const world = new DemoWorld(grassTerrain(16, 16));
    const internals = world as unknown as {
      villagers: Array<{ id: number; x: number; y: number; currentJob: number | null; state: string }>;
      jobs: Array<{ id: number; kind: string; tile: [number, number]; claimedBy: number | null }>;
      refreshGatherJobs(): void;
      tickWorking(index: number): void;
    };
    world.nodes = [{ tile: [8, 8], resource: 'wood', amount: 5, max: 5, regenAcc: 0 }];
    internals.refreshGatherJobs();
    const job = internals.jobs.find((entry) => entry.kind === 'gather')!;
    const villager = internals.villagers[0];
    const tile = 32;
    villager.x = job.tile[0] * tile + tile / 2;
    villager.y = job.tile[1] * tile + tile / 2;
    villager.currentJob = job.id;
    job.claimedBy = villager.id;
    villager.state = 'working';

    completeBuilding(world, 'fence', job.tile[0], job.tile[1]);
    internals.tickWorking(0);

    expect(villager.currentJob).toBeNull();
    expect(villager.state).toBe('idle');
  });
  it('holds a ripe crop and a finished recipe until the buffer has room', () => {
    const world = new DemoWorld(grassTerrain(16, 16));
    const internals = world as unknown as {
      crops: Array<{ kindIndex: number; stage: number; x: number; y: number; watered: boolean }>;
      jobs: Array<{ id: number; kind: string; site: number }>;
      tendHarvestReadyCrop(jobId: number): void;
      tickProduce(jobId: number): void;
      farmNeedsTending(id: number): boolean;
      farmFootprintTiles(id: number): Array<[number, number]>;
    };
    const farm = completeBuilding(world, 'farm', 4, 4);
    const farmJob = internals.jobs.find((job) => job.site === farm && job.kind === 'tend_crops')!;
    const farmInv = world.buildings.find((b) => b.id === farm)!.inventory;
    const tiles = internals.farmFootprintTiles(farm);
    internals.crops = tiles.map(([x, y]) => ({ kindIndex: 0, stage: 99, x, y, watered: true }));
    inventoryAdd(farmInv, 'grain', 30);
    expect(internals.farmNeedsTending(farm)).toBe(false);
    internals.tendHarvestReadyCrop(farmJob.id);
    expect(internals.crops).toHaveLength(tiles.length);
    expect(inventoryGet(farmInv, 'grain')).toBe(30);
    farmInv.grain = 20;
    internals.tendHarvestReadyCrop(farmJob.id);
    expect(internals.crops).toHaveLength(tiles.length - 1);

    const bakery = completeBuilding(world, 'bakery', 10, 10);
    const bakeJob = internals.jobs.find((job) => job.site === bakery && job.kind === 'produce')!;
    const building = world.buildings.find((b) => b.id === bakery)!;
    inventoryAdd(building.inventory, 'flour', 30);
    building.recipeTicks = 1;
    internals.tickProduce(bakeJob.id);
    expect(building.recipeTicks).toBe(1);
    expect(inventoryGet(building.inventory, 'food')).toBe(0);
    building.inventory.flour = 20;
    internals.tickProduce(bakeJob.id);
    expect(building.recipeTicks).toBe(0);
    expect(inventoryGet(building.inventory, 'food')).toBe(2);
  });
});

describe('assigned homes and sleep journeys', () => {
  function tiredWorld() {
    const world = new DemoWorld(grassTerrain());
    const internals = world as unknown as {
      villagers: Array<{
        id: number;
        needs: { energy: number; hunger: number; thirst: number; social: number };
      }>;
    };
    for (const v of internals.villagers) {
      v.needs.energy = 0;
      v.needs.hunger = 1;
      v.needs.thirst = 1;
      v.needs.social = 1;
    }
    return { world, internals };
  }

  it('auto-fills hut beds two per hut', () => {
    const world = new DemoWorld(grassTerrain());
    const first = completeBuilding(world, 'hut', 1, 1);
    const second = completeBuilding(world, 'hut', 10, 10);
    world.advance();
    const homes = world.snapshot().villagers.map((v) => v.home);
    expect(homes.filter((h) => h === first)).toHaveLength(2);
    expect(homes.filter((h) => h === second)).toHaveLength(2);
    expect(homes.filter((h) => h == null)).toHaveLength(1);
  });

  it('walks home to sleep, rests beside the hut, then leaves', () => {
    const world = new DemoWorld(grassTerrain());
    const hut = completeBuilding(world, 'hut', 1, 1);
    world.advance(); // settle auto-fill before anyone gets tired
    const internals = world as unknown as {
      villagers: Array<{
        id: number;
        x: number;
        y: number;
        needs: { energy: number; hunger: number; thirst: number; social: number };
      }>;
    };
    const first = internals.villagers[0];
    first.needs.energy = 0;
    first.needs.hunger = 1;
    first.needs.thirst = 1;
    first.needs.social = 1;
    world.advance();
    let view = villagerById(world, first.id);
    expect(view.home).toBe(hut);
    expect(view.purpose).toBe(4); // home
    expect(view.state).toBe(1);

    for (let i = 0; i < 400 && villagerById(world, first.id).state !== 4; i += 1) world.advance();
    view = villagerById(world, first.id);
    expect(view.state).toBe(4);
    expect(world.getVillagerDetail(first.id).home).toBe(hut);

    for (let i = 0; i < 150 && villagerById(world, first.id).state === 4; i += 1) world.advance();
    expect(villagerById(world, first.id).state).toBe(0);
    expect(world.getVillagerDetail(first.id).home).toBe(hut);
  });

  it('sleeps in place without a home', () => {
    const { world } = tiredWorld();
    world.advance();
    expect(villagerById(world, 1).state).toBe(4);
    expect(villagerById(world, 1).destination).toBeUndefined();
  });

  it('reassigns homes and clears them on demolish', () => {
    const world = new DemoWorld(grassTerrain());
    const oldHut = completeBuilding(world, 'hut', 1, 1);
    completeBuilding(world, 'hut', 10, 10);
    const spareHut = completeBuilding(world, 'hut', 5, 12);
    world.advance();
    expect(world.getVillagerDetail(1).home).toBe(oldHut);

    world.assignHome(1, spareHut);
    expect(world.getVillagerDetail(1).home).toBe(spareHut);
    expect(world.getVillagerDetail(1).homeBuilding).toBe('hut');
    expect(() => world.assignHome(999, spareHut)).toThrow();
    expect(() => world.assignHome(2, 9999)).toThrow();

    world.demolish(spareHut);
    expect(world.getVillagerDetail(1).home).toBeNull();
  });

  it('names workplaces and residences on detail and building views', () => {
    const world = new DemoWorld(grassTerrain());
    const hut = completeBuilding(world, 'hut', 1, 1);
    const farm = completeBuilding(world, 'farm', 10, 10);
    world.resources.grain = 4;
    for (let i = 0; i < 60; i += 1) world.advance();
    const detail = world.getVillagerDetail(1);
    expect(detail.home).toBe(hut);
    expect(detail.homeBuilding).toBe('hut');
    expect(detail.homeTile).toEqual([1, 1]);
    const hutView = world.snapshot().buildings.find((b) => b.id === hut)!;
    expect(hutView.residents).toContain(1);
    expect(detail.jobSite).toBe(farm);
    expect(detail.jobSiteName).toBe('farm');
    expect(detail.jobSiteTile).toEqual([10, 10]);
    const farmView = world.snapshot().buildings.find((b) => b.id === farm)!;
    expect(farmView.workers).toContain(1);
  });
});
