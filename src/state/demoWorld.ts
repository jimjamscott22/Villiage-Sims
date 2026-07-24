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
const STARTING_VILLAGER_NAMES = ['Ash', 'Briar', 'Cora', 'Dale', 'Ellis'] as const;

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

const HYSTERESIS = 0.15;
const WORK_BASELINE = 0.4;
const WANDER_SCORE = 0.05;
const NIGHT_BONUS = 1.5;
const NIGHT_START_MINUTE = 20 * 60;
const NIGHT_END_MINUTE = 6 * 60;
const SOCIAL_RANGE = 8;
const EAT_TICKS = 60;
const SLEEP_TICKS = 100;
const SOCIALIZE_TICKS = 40;
const SOCIAL_RESTORE = 0.5;
const WANDER_RADIUS = 6;
const DEMO_SEED = 42;

type ActionKind = 'eat' | 'sleep' | 'work' | 'socialize' | 'wander';
type MovePurpose = 'player' | 'work' | 'wander';
type AgentStateName = 'idle' | 'moving' | 'working' | 'eating' | 'sleeping' | 'socializing';

const ACTION_ORDER: ActionKind[] = ['eat', 'sleep', 'work', 'socialize', 'wander'];

function actionRank(kind: ActionKind): number {
  return ACTION_ORDER.indexOf(kind);
}

function startingResources(): ResourceTotals {
  return { wood: 120, stone: 40, grain: 0, food: 50, gold: 0 };
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

function isNight(minute: number): boolean {
  return minute >= NIGHT_START_MINUTE || minute < NIGHT_END_MINUTE;
}

function distanceFactor(dist: number): number {
  return 1 / (1 + dist * 0.05);
}

function scoreEat(hunger: number, food: number): number {
  if (food < 1) return 0;
  const deficit = Math.max(0, Math.min(1, 1 - hunger));
  return deficit * deficit;
}

function scoreSleep(energy: number, night: boolean): number {
  const deficit = Math.max(0, Math.min(1, 1 - energy));
  const base = deficit * deficit;
  return night ? Math.min(1, base * NIGHT_BONUS) : base;
}

function scoreWork(priority: number, dist: number): number {
  const priorityScale = priority / 10;
  return Math.max(0, Math.min(1, WORK_BASELINE * priorityScale * distanceFactor(dist)));
}

function scoreSocialize(social: number, partnerInRange: boolean): number {
  if (!partnerInRange) return 0;
  const deficit = Math.max(0, Math.min(1, 1 - social));
  return deficit ** 1.5;
}

function scoreWander(): number {
  return WANDER_SCORE;
}

function chebyshev(a: [number, number], b: [number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

function wrapU64(n: bigint): bigint {
  return n & 0xffff_ffff_ffff_ffffn;
}

function wanderTile(
  from: [number, number],
  seed: number,
  tick: number,
  villagerId: number,
  width: number,
  height: number,
  isPassable: (x: number, y: number) => boolean,
): [number, number] | null {
  let hash = wrapU64(
    BigInt(seed) * 0x9e37_79b9_7f4a_7c15n
      + BigInt(tick)
      + BigInt(villagerId) * 0xc2b2_ae3d_27d4_eb4fn,
  );
  const span = BigInt(2 * WANDER_RADIUS + 1);
  for (let i = 0; i < 16; i += 1) {
    hash = wrapU64(hash * 0xbf58_476d_1ce4_e5b9n + 0x94d0_49bb_1331_11ebn);
    const rawDx = Number(hash % span) - WANDER_RADIUS;
    const rawDy = Number((hash / span) % span) - WANDER_RADIUS;
    if (rawDx === 0 && rawDy === 0) continue;
    const x = Math.max(0, Math.min(width - 1, from[0] + rawDx));
    const y = Math.max(0, Math.min(height - 1, from[1] + rawDy));
    if ((x !== from[0] || y !== from[1]) && isPassable(x, y)) return [x, y];
  }
  return null;
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
  state: AgentStateName;
  purpose: MovePurpose | null;
  target: [number, number] | null;
  path: Array<[number, number]> | null;
  repathCooldown: number;
  needs: DemoNeeds;
  currentJob: number | null;
  workTicksRemaining: number;
  activityTicks: number;
  currentAction: ActionKind | null;
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

interface ScoredAction {
  kind: ActionKind;
  score: number;
  jobId: number | null;
}

function recomputeHappiness(needs: DemoNeeds): void {
  needs.happiness = Math.max(0, Math.min(1, (needs.hunger + needs.energy + needs.social) / 3));
}

function fullNeeds(): DemoNeeds {
  const needs = { hunger: 1, energy: 1, social: 1, happiness: 1 };
  recomputeHappiness(needs);
  return needs;
}

function stateByte(v: DemoVillager): number {
  switch (v.state) {
    case 'idle': return 0;
    case 'moving': return 1;
    case 'working': return 2;
    case 'eating': return 3;
    case 'sleeping': return 4;
    case 'socializing': return 5;
  }
}

function stateLabel(v: DemoVillager): string {
  switch (v.state) {
    case 'idle': return 'Idle';
    case 'moving':
      if (v.purpose === 'work') return 'Going to work';
      if (v.purpose === 'wander') return 'Wandering';
      return 'Moving';
    case 'working': return 'Working';
    case 'eating': return 'Eating';
    case 'sleeping': return 'Sleeping';
    case 'socializing': return 'Socializing';
  }
}

function pickAction(scored: ScoredAction[], current: ActionKind | null): ScoredAction {
  let best: ScoredAction = { kind: 'wander', score: 0, jobId: null };
  for (const action of scored) {
    if (
      action.score > best.score
      || (action.score === best.score && actionRank(action.kind) < actionRank(best.kind))
    ) {
      best = action;
    }
  }
  if (current == null) return best;
  const currentScore = scored.find((a) => a.kind === current)?.score ?? 0;
  if (best.kind !== current && best.score < currentScore + HYSTERESIS) {
    return scored.find((a) => a.kind === current) ?? { kind: current, score: currentScore, jobId: null };
  }
  return best;
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
  private nextVillagerId = 1;
  private villagers: DemoVillager[] = [];
  private jobs: DemoJob[] = [];
  private events: SimEvent[] = [];
  private readonly seed = DEMO_SEED;
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
    this.spawnStartingVillagers();
  }

  private spawnStartingVillagers(): void {
    const cx = Math.floor(this.terrain.width / 2);
    const cy = Math.floor(this.terrain.height / 2);
    const used: Array<[number, number]> = [];
    for (let i = 0; i < STARTING_VILLAGER_NAMES.length; i += 1) {
      const name = STARTING_VILLAGER_NAMES[i];
      const id = this.nextVillagerId;
      this.nextVillagerId += 1;
      const tile = this.findSpawnTile(cx, cy, used) ?? [cx + i, cy];
      used.push(tile);
      const [px, py] = this.tileCenter(tile[0], tile[1]);
      this.villagers.push({
        id,
        name,
        x: px,
        y: py,
        state: 'idle',
        purpose: null,
        target: null,
        path: null,
        repathCooldown: 0,
        needs: fullNeeds(),
        currentJob: null,
        workTicksRemaining: 0,
        activityTicks: 0,
        currentAction: null,
      });
    }
  }

  private findSpawnTile(
    cx: number,
    cy: number,
    used: Array<[number, number]>,
  ): [number, number] | null {
    const first = this.findWalkableNear(cx, cy);
    if (first && !used.some((u) => u[0] === first[0] && u[1] === first[1])) {
      return first;
    }
    const maxR = Math.max(this.terrain.width, this.terrain.height);
    for (let r = 0; r <= maxR; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (used.some((u) => u[0] === x && u[1] === y)) continue;
          if (this.isSpawnCandidate(x, y)) return [x, y];
        }
      }
    }
    return null;
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
    for (let i = 0; i < this.villagers.length; i += 1) {
      this.tickVillagerAt(i);
    }
    return this.snapshot();
  }

  snapshot(): TickSnapshot {
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
      villagers: this.villagers.map((v) => ({
        id: v.id,
        x: v.x,
        y: v.y,
        state: stateByte(v),
      })),
      buildings: this.buildingViews(),
      crops,
      resources: { ...this.resources },
      clock,
      events: [...this.events],
    };
  }

  getVillagerDetail(id: number): VillagerDetail {
    const villager = this.villagers.find((entry) => entry.id === id);
    if (!villager) throw new Error(`unknown villager ${id}`);
    const job = villager.currentJob != null
      ? this.jobs.find((entry) => entry.id === villager.currentJob) ?? null
      : null;
    return {
      id: villager.id,
      name: villager.name,
      state: stateByte(villager),
      stateLabel: stateLabel(villager),
      hunger: villager.needs.hunger,
      energy: villager.needs.energy,
      social: villager.needs.social,
      happiness: villager.needs.happiness,
      jobKind: job?.kind ?? null,
      jobSite: job?.site ?? null,
    };
  }

  moveVillagerTo(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new Error('out of bounds');
    if (!this.isPassable(x, y)) throw new Error('tile impassable');
    const index = this.nearestVillagerIndexTo(x, y);
    if (index < 0) throw new Error('no villagers');
    this.releaseJobAt(index);
    const villager = this.villagers[index];
    const start = this.posToTile(villager.x, villager.y);
    const path = this.computePath(start, [x, y]);
    if (!path) throw new Error('no path');
    villager.state = 'moving';
    villager.purpose = 'player';
    villager.target = [x, y];
    villager.path = path;
    villager.repathCooldown = 0;
    villager.currentAction = null;
  }

  private nearestVillagerIndexTo(x: number, y: number): number {
    let bestIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < this.villagers.length; i += 1) {
      const [vx, vy] = this.posToTile(this.villagers[i].x, this.villagers[i].y);
      const dist = Math.abs(vx - x) + Math.abs(vy - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
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
    this.invalidatePathsIfNeeded();
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
    const released = this.jobs
      .filter((job) => job.site === entityId && job.claimedBy != null)
      .map((job) => job.claimedBy!);
    this.jobs = this.jobs.filter((job) => job.site !== entityId);
    for (const villager of this.villagers) {
      if (released.includes(villager.id)) {
        villager.currentJob = null;
        if (
          villager.state === 'working'
          || (villager.state === 'moving' && villager.purpose === 'work')
        ) {
          this.clearToIdle(villager);
        }
      } else if (villager.currentJob != null && !this.jobs.some((job) => job.id === villager.currentJob)) {
        villager.currentJob = null;
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
    for (const villager of this.villagers) {
      const n = villager.needs;
      n.hunger = Math.max(0, Math.min(1, n.hunger - HUNGER_DECAY));
      n.energy = Math.max(0, Math.min(1, n.energy - ENERGY_DECAY));
      n.social = Math.max(0, Math.min(1, n.social - SOCIAL_DECAY));
      recomputeHappiness(n);
    }
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

  private tickVillagerAt(index: number): void {
    const villager = this.villagers[index];
    if (villager.repathCooldown > 0) villager.repathCooldown -= 1;

    if (villager.currentJob != null && !this.jobs.some((job) => job.id === villager.currentJob)) {
      villager.currentJob = null;
      if (
        villager.state === 'working'
        || (villager.state === 'moving' && villager.purpose === 'work')
      ) {
        this.clearToIdle(villager);
      }
    }

    switch (villager.state) {
      case 'eating':
        this.tickEating(index);
        return;
      case 'sleeping':
        this.tickSleeping(index);
        return;
      case 'socializing':
        this.tickSocializing(index);
        return;
      case 'moving':
        if (villager.target) {
          this.tickMoving(index, villager.target, villager.purpose ?? 'player');
        }
        return;
      case 'idle':
      case 'working':
        this.maybeDecide(index);
        if (this.villagers[index].state === 'working') {
          this.tickWorking(index);
        }
        return;
    }
  }

  private maybeDecide(index: number): void {
    const villager = this.villagers[index];
    if (villager.repathCooldown > 0 && villager.state === 'idle') return;
    if (villager.state !== 'idle' && villager.state !== 'working') return;

    const from = this.posToTile(villager.x, villager.y);
    const partnerInRange = this.partnerInRange(index, from);
    const scored = this.scoreAll(index, from, partnerInRange);
    const picked = pickAction(scored, villager.currentAction);

    if (
      picked.kind === 'work'
      && villager.state === 'working'
      && villager.currentAction === 'work'
    ) {
      return;
    }

    this.beginAction(index, picked.kind, picked.jobId);
  }

  private scoreAll(index: number, from: [number, number], partnerInRange: boolean): ScoredAction[] {
    const villager = this.villagers[index];
    const actions: ScoredAction[] = [
      { kind: 'eat', score: scoreEat(villager.needs.hunger, this.resources.food), jobId: null },
      { kind: 'sleep', score: scoreSleep(villager.needs.energy, isNight(this.clock.minute)), jobId: null },
      { kind: 'socialize', score: scoreSocialize(villager.needs.social, partnerInRange), jobId: null },
      { kind: 'wander', score: scoreWander(), jobId: null },
      this.workCandidate(index, from),
    ];
    return actions;
  }

  private workCandidate(index: number, from: [number, number]): ScoredAction {
    const villager = this.villagers[index];
    if (villager.currentJob != null) {
      const job = this.jobs.find((entry) => entry.id === villager.currentJob);
      if (job) {
        const dist = Math.abs(job.tile[0] - from[0]) + Math.abs(job.tile[1] - from[1]);
        return { kind: 'work', score: scoreWork(job.priority, dist), jobId: job.id };
      }
    }
    const best = this.peekBest(from);
    if (best) {
      const dist = Math.abs(best.tile[0] - from[0]) + Math.abs(best.tile[1] - from[1]);
      return { kind: 'work', score: scoreWork(best.priority, dist), jobId: best.id };
    }
    return { kind: 'work', score: 0, jobId: null };
  }

  private peekBest(from: [number, number]): DemoJob | null {
    let best: { job: DemoJob; score: number } | null = null;
    for (const job of this.jobs) {
      if (job.claimedBy != null) continue;
      const dist = Math.abs(job.tile[0] - from[0]) + Math.abs(job.tile[1] - from[1]);
      const score = job.priority / (1 + dist);
      if (!best || score > best.score) best = { job, score };
    }
    return best?.job ?? null;
  }

  private partnerInRange(index: number, from: [number, number]): boolean {
    const id = this.villagers[index].id;
    return this.villagers.some((other) => {
      if (other.id === id) return false;
      const tile = this.posToTile(other.x, other.y);
      return chebyshev(from, tile) <= SOCIAL_RANGE;
    });
  }

  private beginAction(index: number, kind: ActionKind, jobId: number | null): void {
    switch (kind) {
      case 'eat':
        this.beginEat(index);
        break;
      case 'sleep':
        this.beginSleep(index);
        break;
      case 'socialize':
        this.beginSocialize(index);
        break;
      case 'work':
        this.beginWork(index, jobId);
        break;
      case 'wander':
        this.beginWander(index);
        break;
    }
  }

  private beginEat(index: number): void {
    if (this.resources.food < 1) return;
    this.resources.food -= 1;
    const villager = this.villagers[index];
    villager.path = null;
    villager.target = null;
    villager.purpose = null;
    villager.state = 'eating';
    villager.activityTicks = EAT_TICKS;
    villager.currentAction = 'eat';
  }

  private beginSleep(index: number): void {
    const villager = this.villagers[index];
    villager.path = null;
    villager.target = null;
    villager.purpose = null;
    villager.state = 'sleeping';
    villager.activityTicks = SLEEP_TICKS;
    villager.currentAction = 'sleep';
  }

  private beginSocialize(index: number): void {
    const villager = this.villagers[index];
    villager.path = null;
    villager.target = null;
    villager.purpose = null;
    villager.state = 'socializing';
    villager.activityTicks = SOCIALIZE_TICKS;
    villager.currentAction = 'socialize';
  }

  private beginWork(index: number, jobId: number | null): void {
    const villager = this.villagers[index];
    const from = this.posToTile(villager.x, villager.y);

    let resolved: number | null = null;
    if (villager.currentJob != null) {
      if (this.jobs.some((job) => job.id === villager.currentJob)) {
        resolved = villager.currentJob;
      } else {
        villager.currentJob = null;
      }
    }

    const preferred = resolved ?? jobId;
    let claimed: number | null = null;
    if (preferred != null && this.claimId(preferred, villager.id)) {
      claimed = preferred;
    } else {
      claimed = this.claimBest(villager.id, from);
    }
    if (claimed == null) return;

    villager.currentJob = claimed;
    villager.currentAction = 'work';
    const job = this.jobs.find((entry) => entry.id === claimed)!;
    this.beginMoveToJob(index, job.tile, claimed);
  }

  private claimId(jobId: number, villagerId: number): boolean {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) return false;
    if (job.claimedBy != null && job.claimedBy !== villagerId) return false;
    job.claimedBy = villagerId;
    return true;
  }

  private claimBest(villagerId: number, from: [number, number]): number | null {
    const best = this.peekBest(from);
    if (!best) return null;
    best.claimedBy = villagerId;
    return best.id;
  }

  private beginWander(index: number): void {
    const villager = this.villagers[index];
    const from = this.posToTile(villager.x, villager.y);
    const target = wanderTile(
      from,
      this.seed,
      this.clock.tick,
      villager.id,
      this.terrain.width,
      this.terrain.height,
      (x, y) => this.isPassable(x, y),
    );
    if (!target) {
      villager.currentAction = 'wander';
      return;
    }
    const path = this.computePath(from, target);
    if (path) {
      villager.state = 'moving';
      villager.purpose = 'wander';
      villager.target = target;
      villager.path = path;
      villager.currentAction = 'wander';
    } else {
      villager.currentAction = 'wander';
      villager.repathCooldown = REPATH_COOLDOWN_TICKS;
    }
  }

  private tickEating(index: number): void {
    const villager = this.villagers[index];
    if (villager.activityTicks <= 1) {
      villager.needs.hunger = 1;
      recomputeHappiness(villager.needs);
      villager.state = 'idle';
      villager.path = null;
      villager.target = null;
      villager.purpose = null;
    } else {
      villager.activityTicks -= 1;
    }
  }

  private tickSleeping(index: number): void {
    const villager = this.villagers[index];
    if (villager.activityTicks <= 1) {
      villager.needs.energy = 1;
      recomputeHappiness(villager.needs);
      villager.state = 'idle';
      villager.path = null;
      villager.target = null;
      villager.purpose = null;
    } else {
      villager.activityTicks -= 1;
    }
  }

  private tickSocializing(index: number): void {
    const villager = this.villagers[index];
    const from = this.posToTile(villager.x, villager.y);
    if (!this.partnerInRange(index, from)) {
      villager.state = 'idle';
      return;
    }
    if (villager.activityTicks <= 1) {
      villager.needs.social = Math.min(1, villager.needs.social + SOCIAL_RESTORE);
      recomputeHappiness(villager.needs);
      villager.state = 'idle';
      villager.path = null;
      villager.target = null;
      villager.purpose = null;
    } else {
      villager.activityTicks -= 1;
    }
  }

  private beginMoveToJob(index: number, tile: [number, number], jobId: number): void {
    const villager = this.villagers[index];
    const start = this.posToTile(villager.x, villager.y);
    if (start[0] === tile[0] && start[1] === tile[1]) {
      villager.path = null;
      villager.target = null;
      villager.purpose = null;
      villager.state = 'working';
      villager.workTicksRemaining = WORK_CYCLE_TICKS;
      villager.currentJob = jobId;
      return;
    }
    const path = this.computePath(start, tile);
    if (!path) {
      this.releaseJobAt(index);
      villager.repathCooldown = REPATH_COOLDOWN_TICKS;
      return;
    }
    villager.state = 'moving';
    villager.purpose = 'work';
    villager.target = tile;
    villager.path = path;
  }

  private tickWorking(index: number): void {
    const villager = this.villagers[index];
    if (villager.currentJob == null || !this.jobs.some((job) => job.id === villager.currentJob)) {
      villager.currentJob = null;
      this.clearToIdle(villager);
      return;
    }
    if (villager.workTicksRemaining === WORK_CYCLE_TICKS) {
      this.tendAutoPlant(villager.currentJob);
    }
    this.tendWaterCrops(villager.currentJob);
    if (villager.workTicksRemaining <= 1) {
      villager.workTicksRemaining = WORK_CYCLE_TICKS;
    } else {
      villager.workTicksRemaining -= 1;
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

  private tickMoving(index: number, target: [number, number], purpose: MovePurpose): void {
    const villager = this.villagers[index];
    if (this.pathIsBlocked(index, target)) {
      this.tryRepath(index, target, purpose);
      if (this.villagers[index].state !== 'moving') return;
    }

    if (!villager.path || villager.path.length === 0) {
      const start = this.posToTile(villager.x, villager.y);
      if (start[0] === target[0] && start[1] === target[1]) {
        this.onArrived(index, purpose);
        return;
      }
      this.tryRepath(index, target, purpose);
      if (!this.villagers[index].path || this.villagers[index].path!.length === 0) return;
    }

    const next = this.villagers[index].path![0];
    const [cx, cy] = this.tileCenter(next[0], next[1]);
    const speedPx = (MOVE_SPEED_TILES_PER_SEC * this.terrain.tileSize) / TICKS_PER_SECOND;
    const dx = cx - this.villagers[index].x;
    const dy = cy - this.villagers[index].y;
    const dist = Math.hypot(dx, dy);
    if (dist <= speedPx || dist <= ARRIVE_EPSILON_PX) {
      this.villagers[index].x = cx;
      this.villagers[index].y = cy;
      this.villagers[index].path!.shift();
      if (this.villagers[index].path!.length === 0) this.onArrived(index, purpose);
    } else {
      this.villagers[index].x += (dx / dist) * speedPx;
      this.villagers[index].y += (dy / dist) * speedPx;
    }
  }

  private onArrived(index: number, purpose: MovePurpose): void {
    const villager = this.villagers[index];
    villager.path = null;
    villager.target = null;
    if (purpose === 'player' || purpose === 'wander') {
      villager.purpose = null;
      villager.state = 'idle';
      return;
    }
    if (villager.currentJob != null && this.jobs.some((job) => job.id === villager.currentJob)) {
      villager.purpose = null;
      villager.state = 'working';
      villager.workTicksRemaining = WORK_CYCLE_TICKS;
      return;
    }
    villager.currentJob = null;
    villager.purpose = null;
    villager.state = 'idle';
  }

  private tryRepath(index: number, target: [number, number], purpose: MovePurpose): void {
    const villager = this.villagers[index];
    if (villager.repathCooldown > 0) {
      this.clearToIdle(villager);
      return;
    }
    const start = this.posToTile(villager.x, villager.y);
    const path = this.computePath(start, target);
    if (path) {
      villager.path = path;
      villager.state = 'moving';
      villager.purpose = purpose;
      villager.target = target;
    } else {
      this.clearToIdle(villager);
      villager.repathCooldown = REPATH_COOLDOWN_TICKS;
      if (purpose === 'work') this.releaseJobAt(index);
    }
  }

  private invalidatePathsIfNeeded(): void {
    const movers: Array<{ index: number; target: [number, number]; purpose: MovePurpose }> = [];
    for (let i = 0; i < this.villagers.length; i += 1) {
      const v = this.villagers[i];
      if (v.state === 'moving' && v.target) {
        movers.push({ index: i, target: v.target, purpose: v.purpose ?? 'player' });
      }
    }
    for (const mover of movers) {
      if (this.pathIsBlocked(mover.index, mover.target)) {
        this.tryRepath(mover.index, mover.target, mover.purpose);
      }
    }
  }

  private pathIsBlocked(index: number, target: [number, number]): boolean {
    if (!this.isPassable(target[0], target[1])) return true;
    return (this.villagers[index].path ?? []).some(([x, y]) => !this.isPassable(x, y));
  }

  private clearToIdle(villager: DemoVillager): void {
    villager.state = 'idle';
    villager.purpose = null;
    villager.target = null;
    villager.path = null;
  }

  private releaseJobAt(index: number): void {
    const villager = this.villagers[index];
    if (villager.currentJob == null) return;
    const job = this.jobs.find((entry) => entry.id === villager.currentJob);
    if (job && job.claimedBy === villager.id) job.claimedBy = null;
    villager.currentJob = null;
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
