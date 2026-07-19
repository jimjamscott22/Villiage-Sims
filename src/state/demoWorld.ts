import { findPath, terrainPassable } from './pathfind';
import type {
  BuildingDef,
  BuildingView,
  Catalog,
  PlacementResult,
  PlacementValidity,
  ResourceTotals,
  TerrainSnapshot,
  TickSnapshot,
} from './types';

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
};

/** Matches Rust Terrain enum byte order. */
const TERRAIN_NAMES = ['deep_water', 'shallow_water', 'sand', 'grass', 'forest', 'rock', 'mountain'];

const TICKS_PER_SECOND = 20;
const MOVE_SPEED_TILES_PER_SEC = 2;
const REPATH_COOLDOWN_TICKS = 20;
const ARRIVE_EPSILON_PX = 0.5;

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

interface DemoVillager {
  id: number;
  x: number;
  y: number;
  state: 'idle' | 'moving';
  target: [number, number] | null;
  path: Array<[number, number]> | null;
  repathCooldown: number;
}

export class DemoWorld {
  readonly terrain: TerrainSnapshot;
  resources = startingResources();
  buildings: DemoBuilding[] = [];
  private occupancy: Array<number | null>;
  private nextId = 1;
  private tick = 0;
  private villager: DemoVillager;

  constructor(terrain: TerrainSnapshot) {
    this.terrain = terrain;
    this.occupancy = new Array(terrain.width * terrain.height).fill(null);
    const spawn = this.findWalkableNear(Math.floor(terrain.width / 2), Math.floor(terrain.height / 2))
      ?? [Math.floor(terrain.width / 2), Math.floor(terrain.height / 2)];
    const [cx, cy] = this.tileCenter(spawn[0], spawn[1]);
    this.villager = {
      id: 1,
      x: cx,
      y: cy,
      state: 'idle',
      target: null,
      path: null,
      repathCooldown: 0,
    };
  }

  get catalog(): Catalog {
    return DEMO_CATALOG;
  }

  setViewport(_x: number, _y: number, _w: number, _h: number): void {
    // Browser demo does not viewport-cull yet; method kept for transport parity.
  }

  advance(): TickSnapshot {
    this.tick += 1;
    for (const building of this.buildings) {
      if (building.complete) continue;
      const def = DEMO_CATALOG.buildings[building.kindIndex];
      building.progressTicks += 1;
      if (building.progressTicks >= def.buildTicks) building.complete = true;
    }
    this.tickVillager();
    return this.snapshot();
  }

  snapshot(): TickSnapshot {
    return {
      tick: this.tick,
      villagers: [{
        id: this.villager.id,
        x: this.villager.x,
        y: this.villager.y,
        state: this.villager.state === 'moving' ? 1 : 0,
      }],
      buildings: this.buildingViews(),
      resources: { ...this.resources },
    };
  }

  moveVillagerTo(x: number, y: number): void {
    if (!this.inBounds(x, y)) throw new Error('out of bounds');
    if (!this.isPassable(x, y)) throw new Error('tile impassable');
    const start = this.posToTile(this.villager.x, this.villager.y);
    const path = this.computePath(start, [x, y]);
    if (!path) throw new Error('no path');
    this.villager.state = 'moving';
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
    for (const [tx, ty] of footprintTiles(building.x, building.y, fw, fh)) {
      const tileIndex = ty * this.terrain.width + tx;
      if (this.occupancy[tileIndex] === entityId) this.occupancy[tileIndex] = null;
    }
    for (const [key, amount] of Object.entries(def.cost)) {
      const resourceKey = key as keyof ResourceTotals;
      this.resources[resourceKey] += amount;
    }
    this.buildings.splice(index, 1);
  }

  private tickVillager(): void {
    if (this.villager.repathCooldown > 0) this.villager.repathCooldown -= 1;
    if (this.villager.state !== 'moving' || !this.villager.target) return;

    const target = this.villager.target;
    if (this.pathIsBlocked(target)) {
      this.tryRepath(target);
      if (this.villager.state !== 'moving') return;
    }

    if (!this.villager.path || this.villager.path.length === 0) {
      const start = this.posToTile(this.villager.x, this.villager.y);
      if (start[0] === target[0] && start[1] === target[1]) {
        this.clearToIdle();
        return;
      }
      this.tryRepath(target);
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
      if (this.villager.path!.length === 0) this.clearToIdle();
    } else {
      this.villager.x += (dx / dist) * speedPx;
      this.villager.y += (dy / dist) * speedPx;
    }
  }

  private tryRepath(target: [number, number]): void {
    if (this.villager.repathCooldown > 0) {
      this.clearToIdle();
      return;
    }
    const start = this.posToTile(this.villager.x, this.villager.y);
    const path = this.computePath(start, target);
    if (path) {
      this.villager.path = path;
      this.villager.state = 'moving';
      this.villager.target = target;
    } else {
      this.clearToIdle();
      this.villager.repathCooldown = REPATH_COOLDOWN_TICKS;
    }
  }

  private invalidatePathIfNeeded(): void {
    if (this.villager.state !== 'moving' || !this.villager.target) return;
    if (this.pathIsBlocked(this.villager.target)) {
      this.tryRepath(this.villager.target);
    }
  }

  private pathIsBlocked(target: [number, number]): boolean {
    if (!this.isPassable(target[0], target[1])) return true;
    return (this.villager.path ?? []).some(([x, y]) => !this.isPassable(x, y));
  }

  private clearToIdle(): void {
    this.villager.state = 'idle';
    this.villager.target = null;
    this.villager.path = null;
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
    // Search near the center for the most open connected walkable tile so the
    // browser-demo villager has room to path around obstacles.
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
