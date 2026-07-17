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

export class DemoWorld {
  readonly terrain: TerrainSnapshot;
  resources = startingResources();
  buildings: DemoBuilding[] = [];
  private occupancy: Array<number | null>;
  private nextId = 1;
  private tick = 0;

  constructor(terrain: TerrainSnapshot) {
    this.terrain = terrain;
    this.occupancy = new Array(terrain.width * terrain.height).fill(null);
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
    return this.snapshot();
  }

  snapshot(): TickSnapshot {
    const worldWidth = this.terrain.width * this.terrain.tileSize;
    const worldHeight = this.terrain.height * this.terrain.tileSize;
    const centerX = worldWidth / 2;
    const centerY = worldHeight / 2;
    const radius = Math.min(worldWidth, worldHeight) * 0.32;
    const angle = (this.tick * Math.PI * 2) / 200;
    return {
      tick: this.tick,
      villagers: [{ id: 1, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius }],
      buildings: this.buildingViews(),
      resources: { ...this.resources },
    };
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
