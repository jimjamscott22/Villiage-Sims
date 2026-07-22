import { findPath, terrainPassable } from './pathfind';
import type {
  BuildingDef,
  BuildingView,
  Catalog,
  ClockView,
  CropDef,
  CropView,
  PlacementResult,
  PlacementValidity,
  ResourceTotals,
  SimEvent,
  TerrainSnapshot,
  TickSnapshot,
  VillagerDetail,
} from './types';

const DEMO_CROPS: CropDef[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    stages: 4,
    ticksPerStage: 400,
    seasons: ['spring', 'summer'],
    waterRequired: true,
    yield: { grain: 3 },
    seedCost: { grain: 1 },
  },
];

export const DEMO_CATALOG: Catalog = {
  buildings: [
    {
      id: 'hut',
      name: 'Hut',
      footprint: [1, 1],
      cost: { wood: 20 },
      buildTicks: 40,
      category: 'housing',
      houses: 2,
      validTerrain: ['grass', 'sand'],
      jobs: [],
    },
    {
      id: 'farm',
      name: 'Farm Plot',
      footprint: [3, 3],
      cost: { wood: 10 },
      buildTicks: 30,
      category: 'production',
      validTerrain: ['grass'],
      jobs: [{ kind: 'tend_crops', slots: 2 }],
    },
    {
      id: 'granary',
      name: 'Granary',
      footprint: [2, 2],
      cost: { wood: 40, stone: 10 },
      buildTicks: 60,
      category: 'storage',
      stores: ['food'],
      capacity: 500,
      validTerrain: ['grass', 'sand'],
      jobs: [{ kind: 'haul', slots: 1 }],
    },
  ],
  crops: DEMO_CROPS,
};

/** Matches Rust Terrain enum byte order. */
const TERRAIN_NAMES = ['deep_water', 'shallow_water', 'sand', 'grass', 'forest', 'rock', 'mountain'];
const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;

const TICKS_PER_SECOND = 20;
const MOVE_SPEED_TILES_PER_SEC = 2;
const REPATH_COOLDOWN_TICKS = 20;
const ARRIVE_EPSILON_PX = 0.5;
const HUNGER_DECAY = 0.00008;
const ENERGY_DECAY = 0.00005;
const SOCIAL_DECAY = 0.00003;
const WORK_CYCLE_TICKS = 40;
const DEFAULT_JOB_PRIORITY = 10;
const MINUTES_PER_TICK = 0.06;
const MINUTES_PER_DAY = 1440;
const DAYS_PER_SEASON = 28;

function startingResources(): ResourceTotals {
  return { wood: 120, stone: 40, grain: 0, food: 0, gold: 0 };
}

function rotatedFootprint(def: BuildingDef, rotation: number): [number, number] {
  const [w, h] = def.footprint;
  return rotation % 2 === 0 ? [w, h] : [h, w];
}

function footprintTiles(x: number, y: number, fw: number, fh: number): Array<[number, number]> {
  const tiles: Array<[number, number]> = [];
  for (let dy = 0; dy < fh; dy += 1) {
    for (let dx = 0; dx < fw; dx += 1) {
      tiles.push([x + dx, y + dy]);
    }
  }
  return tiles;
}

interface DemoBuilding {
  id: number;
  kindIndex: number;
  x: number;
  y: number;
  rot: number;
  progressTicks: number;
  complete: boolean;
}

interface DemoCrop {
  id: number;
  kind: string;
  kindIndex: number;
  x: number;
  y: number;
  stage: number;
  growthTicks: number;
  watered: boolean;
  readyEmitted: boolean;
}

interface DemoJob {
  id: number;
  kind: 'tend_crops';
  site: number;
  tile: [number, number];
  priority: number;
  claimedBy: number | null;
}

interface DemoNeeds {
  hunger: number;
  energy: number;
  social: number;
  happiness: number;
}

interface DemoVillager {
  id: number;
  name: string;
  x: number;
  y: number;
  state: 'idle' | 'moving' | 'working';
  purpose: 'player' | 'work' | null;
  target: [number, number] | null;
  path: Array<[number, number]> | null;
  repathCooldown: number;
  needs: DemoNeeds;
  currentJob: number | null;
  workTicksRemaining: number;
}

interface DemoClock {
  tick: number;
  minuteAccum: number;
  minute: number;
  day: number;
  season: number;
  year: number;
  speed: number;
}

function recomputeHappiness(needs: DemoNeeds): void {
  needs.happiness = Math.max(0, Math.min(1, (needs.hunger + needs.energy + needs.social) / 3));
}

function fullNeeds(): DemoNeeds {
  const needs = { hunger: 1, energy: 1, social: 1, happiness: 1 };
  recomputeHappiness(needs);
  return needs;
}

export class DemoWorld {
  readonly terrain: TerrainSnapshot;
  resources = startingResources();
  buildings: DemoBuilding[] = [];
  crops: DemoCrop[] = [];
  private occupancy: Array<number | null>;
  private nextId = 1;
  private nextCropId = 1;
  private nextJobId = 1;
  private villager: DemoVillager;
  private jobs: DemoJob[] = [];
  private events: SimEvent[] = [];
  private clock: DemoClock = {
    tick: 0,
    minuteAccum: 0,
    minute: 0,
    day: 1,
    season: 0,
    year: 1,
    speed: 1,
  };

  constructor(terrain: TerrainSnapshot) {
    this.terrain = terrain;
    this.occupancy = new Array(terrain.width * terrain.height).fill(null);
    const spawn = this.findWalkableNear(Math.floor(terrain.width / 2), Math.floor(terrain.height / 2))
      ?? [Math.floor(terrain.width / 2), Math.floor(terrain.height / 2)];
    const [cx, cy] = this.tileCenter(spawn[0], spawn[1]);
    this.villager = {
      id: 1,
      name: 'Ash',
      x: cx,
      y: cy,
      state: 'idle',
      purpose: null,
      target: null,
      path: null,
      repathCooldown: 0,
      needs: fullNeeds(),
      currentJob: null,
      workTicksRemaining: 0,
    };
  }

  get catalog(): Catalog {
    return DEMO_CATALOG;
  }

  get speed(): number {
    return this.clock.speed;
  }

  setViewport(_x: number, _y: number, _w: number, _h: number): void {
    // Browser demo does not viewport-cull yet; method kept for transport parity.
  }

  setSpeed(speed: number): void {
    if (speed < 0 || speed > 3) throw new Error(`invalid speed ${speed}`);
    this.clock.speed = speed;
  }

  advance(): TickSnapshot {
    if (this.clock.speed === 0) return this.snapshot();
    this.events = [];
    this.clock.tick += 1;
    this.clock.minuteAccum += MINUTES_PER_TICK;
    this.clock.minute = Math.floor(this.clock.minuteAccum);
    if (this.clock.minuteAccum >= MINUTES_PER_DAY) {
      this.clock.minuteAccum -= MINUTES_PER_DAY;
      this.clock.minute = Math.floor(this.clock.minuteAccum);
      this.rollDay();
      this.clearAllCropWater();
    }

    const newlyComplete: number[] = [];
    for (const building of this.buildings) {
      if (building.complete) continue;
      const def = DEMO_CATALOG.buildings[building.kindIndex];
      building.progressTicks += 1;
      if (building.progressTicks >= def.buildTicks) {
        building.complete = true;
        newlyComplete.push(building.id);
      }
    }
    for (const id of newlyComplete) this.advertiseJobsFor(id);

    this.tickCrops();
    this.decayNeeds();
    this.tickVillager();
    return this.snapshot();
  }

  snapshot(): TickSnapshot {
    const stateByte = this.villager.state === 'working' ? 2 : this.villager.state === 'moving' ? 1 : 0;
    const clock: ClockView = {
      minute: this.clock.minute,
      day: this.clock.day,
      season: this.clock.season,
      year: this.clock.year,
      speed: this.clock.speed,
    };
    const crops: CropView[] = this.crops.map((crop) => ({
      id: crop.id,
      x: crop.x,
      y: crop.y,
      kind: crop.kindIndex,
      stage: crop.stage,
    }));
    return {
      tick: this.clock.tick,
      villagers: [{
        id: this.villager.id,
        x: this.villager.x,
        y: this.villager.y,
        state: stateByte,
      }],
      buildings: this.buildingViews(),
      crops,
      resources: { ...this.resources },
      clock,
      events: [...this.events],
    };
  }

  getVillagerDetail(id: number): VillagerDetail {
    if (this.villager.id !== id) throw new Error(`unknown villager ${id}`);
    const job = this.villager.currentJob != null
      ? this.jobs.find((entry) => entry.id === this.villager.currentJob) ?? null
      : null;
    const stateLabel = this.villager.state === 'working'
      ? 'Working'
      : this.villager.state === 'moving'
        ? (this.villager.purpose === 'work' ? 'Going to work' : 'Moving')
        : 'Idle';
    return {
      id: this.villager.id,
      name: this.villager.name,
      state: this.villager.state === 'working' ? 2 : this.villager.state === 'moving' ? 1 : 0,
      stateLabel,
      hunger: this.villager.needs.hunger,
      energy: this.villager.needs.energy,
      social: this.villager.needs.social,
      happiness: this.villager.needs.happiness,
      jobKind: job?.kind ?? null,
      jobSite: job?.site ?? null,
    };
  }

  moveVillagerTo(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new Error('out of bounds');
    if (!this.isPassable(x, y)) throw new Error('tile impassable');
    this.releaseCurrentJob();
    const start = this.posToTile(this.villager.x, this.villager.y);
    const path = this.computePath(start, [x, y]);
    if (!path) throw new Error('no path');
    this.villager.state = 'moving';
    this.villager.purpose = 'player';
    this.villager.target = [x, y];
    this.villager.path = path;
    this.villager.repathCooldown = 0;
  }

  validatePlacement(kind: string, x: number, y: number, rotation: number): PlacementValidity {
    const kindIndex = DEMO_CATALOG.buildings.findIndex((building) => building.id === kind);
    if (kindIndex < 0) return { valid: false, reason: `unknown building '${kind}'` };
    const def = DEMO_CATALOG.buildings[kindIndex];
    const [fw, fh] = rotatedFootprint(def, rotation);
    for (const [tx, ty] of footprintTiles(x, y, fw, fh)) {
      if (tx < 0 || ty < 0 || tx >= this.terrain.width || ty >= this.terrain.height) {
        return { valid: false, reason: 'out of bounds' };
      }
      const index = ty * this.terrain.width + tx;
      const terrainName = TERRAIN_NAMES[this.terrain.tiles[index]] ?? 'deep_water';
      if (!def.validTerrain.includes(terrainName)) {
        return { valid: false, reason: `invalid terrain for ${def.id}` };
      }
      if (this.occupancy[index] != null) return { valid: false, reason: 'tile occupied' };
    }
    for (const [key, amount] of Object.entries(def.cost)) {
      if ((this.resources[key as keyof ResourceTotals] ?? 0) < amount) {
        return { valid: false, reason: 'insufficient resources' };
      }
    }
    return { valid: true, reason: '' };
  }

  placeBuilding(kind: string, x: number, y: number, rotation: number): PlacementResult {
    const validity = this.validatePlacement(kind, x, y, rotation);
    if (!validity.valid) throw new Error(validity.reason);
    const kindIndex = DEMO_CATALOG.buildings.findIndex((building) => building.id === kind);
    const def = DEMO_CATALOG.buildings[kindIndex];
    const [fw, fh] = rotatedFootprint(def, rotation);
    for (const [key, amount] of Object.entries(def.cost)) {
      const resourceKey = key as keyof ResourceTotals;
      this.resources[resourceKey] -= amount;
    }
    const id = this.nextId;
    this.nextId += 1;
    for (const [tx, ty] of footprintTiles(x, y, fw, fh)) {
      this.occupancy[ty * this.terrain.width + tx] = id;
    }
    this.buildings.push({
      id,
      kindIndex,
      x,
      y,
      rot: rotation % 4,
      progressTicks: 0,
      complete: false,
    });
    this.invalidatePathIfNeeded();
    return { id };
  }

  demolish(entityId: number): void {
    const index = this.buildings.findIndex((building) => building.id === entityId);
    if (index < 0) throw new Error(`unknown building ${entityId}`);
    const building = this.buildings[index];
    const def = DEMO_CATALOG.buildings[building.kindIndex];
    const [fw, fh] = rotatedFootprint(def, building.rot);
    const tiles = footprintTiles(building.x, building.y, fw, fh);
    for (const [tx, ty] of tiles) {
      const tileIndex = ty * this.terrain.width + tx;
      if (this.occupancy[tileIndex] === entityId) this.occupancy[tileIndex] = null;
    }
    this.crops = this.crops.filter(
      (crop) => !tiles.some(([tx, ty]) => crop.x === tx && crop.y === ty),
    );
    for (const [key, amount] of Object.entries(def.cost)) {
      const resourceKey = key as keyof ResourceTotals;
      this.resources[resourceKey] += amount;
    }
    this.buildings.splice(index, 1);
    const released = this.jobs.filter((job) => job.site === entityId && job.claimedBy != null)
      .map((job) => job.claimedBy!);
    this.jobs = this.jobs.filter((job) => job.site !== entityId);
    if (released.includes(this.villager.id)) {
      this.villager.currentJob = null;
      if (this.villager.state === 'working' || (this.villager.state === 'moving' && this.villager.purpose === 'work')) {
        this.clearToIdle();
      }
    }
  }

  plantCrop(kind: string, x: number, y: number): void {
    const kindIndex = DEMO_CROPS.findIndex((crop) => crop.id === kind);
    if (kindIndex < 0) throw new Error(`unknown crop '${kind}'`);
    if (this.completedFarmAt(x, y) == null) throw new Error('tile is not on a completed farm');
    if (this.crops.some((crop) => crop.x === x && crop.y === y)) {
      throw new Error('tile already has a crop');
    }
    const id = this.nextCropId;
    this.nextCropId += 1;
    this.crops.push({
      id,
      kind,
      kindIndex,
      x,
      y,
      stage: 0,
      growthTicks: 0,
      watered: false,
      readyEmitted: false,
    });
  }

  advanceClock(days: number, season: number | null): void {
    for (let i = 0; i < days; i += 1) {
      this.clock.minuteAccum = 0;
      this.clock.minute = 0;
      this.rollDay();
      this.clearAllCropWater();
    }
    if (season != null) {
      if (season < 0 || season > 3) throw new Error(`invalid season ${season}`);
      this.clock.season = season;
    }
  }

  private decayNeeds(): void {
    const n = this.villager.needs;
    n.hunger = Math.max(0, Math.min(1, n.hunger - HUNGER_DECAY));
    n.energy = Math.max(0, Math.min(1, n.energy - ENERGY_DECAY));
    n.social = Math.max(0, Math.min(1, n.social - SOCIAL_DECAY));
    recomputeHappiness(n);
  }

  private advertiseJobsFor(buildingId: number): void {
    const building = this.buildings.find((entry) => entry.id === buildingId);
    if (!building) return;
    const def = DEMO_CATALOG.buildings[building.kindIndex];
    this.jobs = this.jobs.filter((job) => job.site !== buildingId);
    const [fw, fh] = rotatedFootprint(def, building.rot);
    const standTiles = this.adjacentStandTiles(building.x, building.y, fw, fh);
    let tileIndex = 0;
    for (const jobDef of def.jobs ?? []) {
      if (jobDef.kind !== 'tend_crops') continue;
      for (let slot = 0; slot < jobDef.slots; slot += 1) {
        if (tileIndex >= standTiles.length) return;
        const tile = standTiles[tileIndex];
        tileIndex += 1;
        const id = this.nextJobId;
        this.nextJobId += 1;
        this.jobs.push({
          id,
          kind: 'tend_crops',
          site: buildingId,
          tile,
          priority: DEFAULT_JOB_PRIORITY,
          claimedBy: null,
        });
      }
    }
  }

  private adjacentStandTiles(x: number, y: number, fw: number, fh: number): Array<[number, number]> {
    const x0 = x;
    const y0 = y;
    const x1 = x + fw - 1;
    const y1 = y + fh - 1;
    const candidates: Array<[number, number]> = [];
    for (let tx = x0 - 1; tx <= x1 + 1; tx += 1) {
      for (const ty of [y0 - 1, y1 + 1]) {
        if (this.isPassable(tx, ty)) candidates.push([tx, ty]);
      }
    }
    for (let ty = y0; ty <= y1; ty += 1) {
      for (const tx of [x0 - 1, x1 + 1]) {
        if (this.isPassable(tx, ty)) candidates.push([tx, ty]);
      }
    }
    candidates.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    const unique: Array<[number, number]> = [];
    for (const tile of candidates) {
      if (!unique.some((u) => u[0] === tile[0] && u[1] === tile[1])) unique.push(tile);
    }
    return unique;
  }

  private tickVillager(): void {
    if (this.villager.repathCooldown > 0) this.villager.repathCooldown -= 1;

    if (this.villager.currentJob != null && !this.jobs.some((job) => job.id === this.villager.currentJob)) {
      this.villager.currentJob = null;
      if (this.villager.state === 'working' || (this.villager.state === 'moving' && this.villager.purpose === 'work')) {
        this.clearToIdle();
      }
    }

    if (this.villager.state === 'idle') {
      this.tickIdle();
      return;
    }
    if (this.villager.state === 'working') {
      this.tickWorking();
      return;
    }
    if (this.villager.state === 'moving' && this.villager.target) {
      this.tickMoving(this.villager.target, this.villager.purpose ?? 'player');
    }
  }

  private tickIdle(): void {
    if (this.villager.repathCooldown > 0) return;
    if (this.villager.currentJob != null) {
      const job = this.jobs.find((entry) => entry.id === this.villager.currentJob);
      if (job) {
        this.beginMoveToJob(job.tile, job.id);
        return;
      }
      this.villager.currentJob = null;
    }
    const from = this.posToTile(this.villager.x, this.villager.y);
    const jobId = this.claimBest(from);
    if (jobId == null) return;
    const job = this.jobs.find((entry) => entry.id === jobId)!;
    this.villager.currentJob = jobId;
    this.beginMoveToJob(job.tile, jobId);
  }

  private claimBest(from: [number, number]): number | null {
    let best: { id: number; score: number } | null = null;
    for (const job of this.jobs) {
      if (job.claimedBy != null) continue;
      const dist = Math.abs(job.tile[0] - from[0]) + Math.abs(job.tile[1] - from[1]);
      const score = job.priority / (1 + dist);
      if (!best || score > best.score) best = { id: job.id, score };
    }
    if (!best) return null;
    const job = this.jobs.find((entry) => entry.id === best!.id)!;
    job.claimedBy = this.villager.id;
    return job.id;
  }

  private beginMoveToJob(tile: [number, number], _jobId: number): void {
    const start = this.posToTile(this.villager.x, this.villager.y);
    if (start[0] === tile[0] && start[1] === tile[1]) {
      this.villager.path = null;
      this.villager.target = null;
      this.villager.purpose = null;
      this.villager.state = 'working';
      this.villager.workTicksRemaining = WORK_CYCLE_TICKS;
      return;
    }
    const path = this.computePath(start, tile);
    if (!path) {
      this.releaseCurrentJob();
      this.villager.repathCooldown = REPATH_COOLDOWN_TICKS;
      return;
    }
    this.villager.state = 'moving';
    this.villager.purpose = 'work';
    this.villager.target = tile;
    this.villager.path = path;
  }

  private tickWorking(): void {
    if (this.villager.currentJob == null
      || !this.jobs.some((job) => job.id === this.villager.currentJob)) {
      this.villager.currentJob = null;
      this.clearToIdle();
      return;
    }
    if (this.villager.workTicksRemaining === WORK_CYCLE_TICKS) {
      this.tendAutoPlant(this.villager.currentJob);
    }
    this.tendWaterCrops(this.villager.currentJob);
    if (this.villager.workTicksRemaining <= 1) {
      this.villager.workTicksRemaining = WORK_CYCLE_TICKS;
    } else {
      this.villager.workTicksRemaining -= 1;
    }
  }

  private rollDay(): void {
    this.clock.day += 1;
    if (this.clock.day > DAYS_PER_SEASON) {
      this.clock.day = 1;
      this.clock.season += 1;
      if (this.clock.season > 3) {
        this.clock.season = 0;
        this.clock.year += 1;
      }
    }
  }

  private clearAllCropWater(): void {
    for (const crop of this.crops) crop.watered = false;
  }

  private tickCrops(): void {
    const seasonName = SEASON_IDS[this.clock.season];
    for (const crop of this.crops) {
      const def = DEMO_CROPS[crop.kindIndex];
      if (!def) continue;
      const maxStage = def.stages - 1;
      if (crop.stage >= maxStage) continue;
      if (!def.seasons.includes(seasonName)) continue;
      if (def.waterRequired && !crop.watered) continue;
      crop.growthTicks += 1;
      if (crop.growthTicks < def.ticksPerStage) continue;
      crop.growthTicks = 0;
      crop.stage = Math.min(maxStage, crop.stage + 1);
      if (crop.stage >= maxStage && !crop.readyEmitted) {
        crop.readyEmitted = true;
        this.events.push({ kind: 'cropReady', id: crop.id });
      }
    }
  }

  private completedFarmAt(x: number, y: number): number | null {
    for (const building of this.buildings) {
      if (!building.complete) continue;
      const def = DEMO_CATALOG.buildings[building.kindIndex];
      if (def.id !== 'farm') continue;
      const [fw, fh] = rotatedFootprint(def, building.rot);
      for (const [tx, ty] of footprintTiles(building.x, building.y, fw, fh)) {
        if (tx === x && ty === y) return building.id;
      }
    }
    return null;
  }

  private farmFootprintTiles(buildingId: number): Array<[number, number]> {
    const building = this.buildings.find((entry) => entry.id === buildingId);
    if (!building) return [];
    const def = DEMO_CATALOG.buildings[building.kindIndex];
    const [fw, fh] = rotatedFootprint(def, building.rot);
    return footprintTiles(building.x, building.y, fw, fh);
  }

  private tendWaterCrops(jobId: number): void {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    const tiles = this.farmFootprintTiles(job.site);
    for (const crop of this.crops) {
      if (tiles.some(([tx, ty]) => crop.x === tx && crop.y === ty)) {
        crop.watered = true;
      }
    }
  }

  private tendAutoPlant(jobId: number): void {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    const wheat = DEMO_CROPS.find((crop) => crop.id === 'wheat');
    if (!wheat) return;
    const seasonName = SEASON_IDS[this.clock.season];
    if (!wheat.seasons.includes(seasonName)) return;
    const kindIndex = DEMO_CROPS.findIndex((crop) => crop.id === 'wheat');
    const tiles = this.farmFootprintTiles(job.site);
    const empty = tiles.find(([tx, ty]) =>
      this.completedFarmAt(tx, ty) === job.site
      && !this.crops.some((crop) => crop.x === tx && crop.y === ty)
    );
    if (!empty) return;
    const id = this.nextCropId;
    this.nextCropId += 1;
    this.crops.push({
      id,
      kind: 'wheat',
      kindIndex,
      x: empty[0],
      y: empty[1],
      stage: 0,
      growthTicks: 0,
      watered: false,
      readyEmitted: false,
    });
  }

  private tickMoving(target: [number, number], purpose: 'player' | 'work'): void {
    if (this.pathIsBlocked(target)) {
      this.tryRepath(target, purpose);
      if (this.villager.state !== 'moving') return;
    }

    if (!this.villager.path || this.villager.path.length === 0) {
      const start = this.posToTile(this.villager.x, this.villager.y);
      if (start[0] === target[0] && start[1] === target[1]) {
        this.onArrived(purpose);
        return;
      }
      this.tryRepath(target, purpose);
      if (!this.villager.path || this.villager.path.length === 0) return;
    }

    const next = this.villager.path![0];
    const [cx, cy] = this.tileCenter(next[0], next[1]);
    const speedPx = (MOVE_SPEED_TILES_PER_SEC * this.terrain.tileSize) / TICKS_PER_SECOND;
    const dx = cx - this.villager.x;
    const dy = cy - this.villager.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= speedPx || dist <= ARRIVE_EPSILON_PX) {
      this.villager.x = cx;
      this.villager.y = cy;
      this.villager.path!.shift();
      if (this.villager.path!.length === 0) this.onArrived(purpose);
    } else {
      this.villager.x += (dx / dist) * speedPx;
      this.villager.y += (dy / dist) * speedPx;
    }
  }

  private onArrived(purpose: 'player' | 'work'): void {
    this.villager.path = null;
    this.villager.target = null;
    if (purpose === 'player') {
      this.villager.purpose = null;
      this.villager.state = 'idle';
      return;
    }
    if (this.villager.currentJob != null
      && this.jobs.some((job) => job.id === this.villager.currentJob)) {
      this.villager.purpose = null;
      this.villager.state = 'working';
      this.villager.workTicksRemaining = WORK_CYCLE_TICKS;
      return;
    }
    this.villager.currentJob = null;
    this.villager.purpose = null;
    this.villager.state = 'idle';
  }

  private tryRepath(target: [number, number], purpose: 'player' | 'work'): void {
    if (this.villager.repathCooldown > 0) {
      this.clearToIdle();
      return;
    }
    const start = this.posToTile(this.villager.x, this.villager.y);
    const path = this.computePath(start, target);
    if (path) {
      this.villager.path = path;
      this.villager.state = 'moving';
      this.villager.purpose = purpose;
      this.villager.target = target;
    } else {
      this.clearToIdle();
      this.villager.repathCooldown = REPATH_COOLDOWN_TICKS;
      if (purpose === 'work') this.releaseCurrentJob();
    }
  }

  private invalidatePathIfNeeded(): void {
    if (this.villager.state !== 'moving' || !this.villager.target) return;
    if (this.pathIsBlocked(this.villager.target)) {
      this.tryRepath(this.villager.target, this.villager.purpose ?? 'player');
    }
  }

  private pathIsBlocked(target: [number, number]): boolean {
    if (!this.isPassable(target[0], target[1])) return true;
    return (this.villager.path ?? []).some(([x, y]) => !this.isPassable(x, y));
  }

  private clearToIdle(): void {
    this.villager.state = 'idle';
    this.villager.purpose = null;
    this.villager.target = null;
    this.villager.path = null;
  }

  private releaseCurrentJob(): void {
    if (this.villager.currentJob == null) return;
    const job = this.jobs.find((entry) => entry.id === this.villager.currentJob);
    if (job && job.claimedBy === this.villager.id) job.claimedBy = null;
    this.villager.currentJob = null;
  }

  private computePath(start: [number, number], goal: [number, number]): Array<[number, number]> | null {
    return findPath(
      start,
      goal,
      this.terrain.width,
      this.terrain.height,
      (x, y) => (x === start[0] && y === start[1]) || this.isPassable(x, y),
    );
  }

  private isPassable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const index = y * this.terrain.width + x;
    if (this.occupancy[index] != null) return false;
    return terrainPassable(this.terrain.tiles[index] ?? 0);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.terrain.width && y < this.terrain.height;
  }

  private tileCenter(x: number, y: number): [number, number] {
    const tile = this.terrain.tileSize;
    return [(x + 0.5) * tile, (y + 0.5) * tile];
  }

  private posToTile(x: number, y: number): [number, number] {
    const tile = this.terrain.tileSize;
    return [
      Math.min(this.terrain.width - 1, Math.max(0, Math.floor(x / tile))),
      Math.min(this.terrain.height - 1, Math.max(0, Math.floor(y / tile))),
    ];
  }

  private findWalkableNear(cx: number, cy: number): [number, number] | null {
    const searchR = Math.min(48, Math.max(this.terrain.width, this.terrain.height));
    let best: { x: number; y: number; score: number; dist: number } | null = null;
    for (let y = cy - searchR; y <= cy + searchR; y += 1) {
      for (let x = cx - searchR; x <= cx + searchR; x += 1) {
        if (!this.isSpawnCandidate(x, y)) continue;
        const score = this.opennessScore(x, y);
        const dist = Math.abs(x - cx) + Math.abs(y - cy);
        if (
          !best
          || score > best.score
          || (score === best.score && dist < best.dist)
        ) {
          best = { x, y, score, dist };
        }
      }
    }
    if (best) return [best.x, best.y];
    if (this.isPassable(cx, cy)) return [cx, cy];
    const maxR = Math.max(this.terrain.width, this.terrain.height);
    for (let r = 1; r <= maxR; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.isPassable(x, y)) return [x, y];
        }
      }
    }
    return null;
  }

  private isSpawnCandidate(x: number, y: number): boolean {
    if (!this.isPassable(x, y)) return false;
    return (
      this.isPassable(x + 1, y)
      || this.isPassable(x - 1, y)
      || this.isPassable(x, y + 1)
      || this.isPassable(x, y - 1)
    );
  }

  private opennessScore(x: number, y: number): number {
    let score = 0;
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        if (this.isPassable(x + dx, y + dy)) score += 1;
      }
    }
    return score;
  }

  private buildingViews(): BuildingView[] {
    return this.buildings.map((building) => {
      const def = DEMO_CATALOG.buildings[building.kindIndex];
      const progress = building.complete
        ? 100
        : Math.min(100, Math.floor((building.progressTicks * 100) / Math.max(1, def.buildTicks)));
      return {
        id: building.id,
        kind: building.kindIndex,
        x: building.x,
        y: building.y,
        rot: building.rot,
        state: building.complete ? 2 : 1,
        progress,
      };
    });
  }
}
