import type { TerrainSnapshot } from '../state/types';
import type { Atlas } from './atlas';
import { ART_SCALE, drawCell } from './atlas';

export type BaseTerrainName = 'deepWater' | 'shallowWater' | 'sand' | 'grass' | 'rock';

/** Terrain enum from the Rust side: 0 Deep, 1 Shallow, 2 Sand, 3 Grass, 4 Forest, 5 Rock, 6 Mountain. */
const BASE_BY_TERRAIN: BaseTerrainName[] = [
  'deepWater',
  'shallowWater',
  'sand',
  'grass',
  'grass', // Forest draws on grass; the trees are a separate standing prop.
  'rock',
  'rock', // Mountain draws on rock; the peak is a separate standing prop.
];

const PRIORITY: Record<BaseTerrainName, number> = {
  deepWater: 0,
  shallowWater: 1,
  sand: 2,
  grass: 3,
  rock: 4,
};

const VARIANT_COUNT = 4;

export function baseTerrainOf(terrain: number): BaseTerrainName {
  return BASE_BY_TERRAIN[terrain] ?? 'grass';
}

export function priorityOf(terrain: number): number {
  return PRIORITY[baseTerrainOf(terrain)];
}

/**
 * Deterministic hash for variant selection. Intentionally a local copy rather
 * than an import from `tools/genart/hash.ts`: `tools/` and `src/` compile under
 * different tsconfigs. The two copies need not agree — the generator never picks
 * variants, it only emits all four — this one just has to be stable so a tile
 * looks the same on every load and after a save/load round trip.
 */
function hash01(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function variantIndex(x: number, y: number): number {
  return Math.floor(hash01(x, y, 1) * VARIANT_COUNT) % VARIANT_COUNT;
}

const SIDES = [
  { edge: 'n', dx: 0, dy: -1 },
  { edge: 'e', dx: 1, dy: 0 },
  { edge: 's', dx: 0, dy: 1 },
  { edge: 'w', dx: -1, dy: 0 },
] as const;

const CORNERS = [
  { name: 'nw', dx: -1, dy: -1, a: 'n', b: 'w' },
  { name: 'ne', dx: 1, dy: -1, a: 'n', b: 'e' },
  { name: 'se', dx: 1, dy: 1, a: 's', b: 'e' },
  { name: 'sw', dx: -1, dy: 1, a: 's', b: 'w' },
] as const;

export interface TilePlan {
  base: string;
  fringes: string[];
}

/** Plan one tile: its base cell plus every fringe a higher neighbour casts onto it. */
export function planTile(
  tiles: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
): TilePlan {
  const self = tiles[y * width + x];
  const selfPriority = priorityOf(self);

  // Out-of-bounds neighbours read as "same as self" so map borders stay clean.
  const at = (nx: number, ny: number): number =>
    nx < 0 || ny < 0 || nx >= width || ny >= height ? self : tiles[ny * width + nx];

  const higherSides = new Map<BaseTerrainName, Set<string>>();
  const add = (terrain: BaseTerrainName, edge: string) => {
    const set = higherSides.get(terrain) ?? new Set<string>();
    set.add(edge);
    higherSides.set(terrain, set);
  };

  for (const side of SIDES) {
    const neighbour = at(x + side.dx, y + side.dy);
    if (priorityOf(neighbour) > selfPriority) add(baseTerrainOf(neighbour), side.edge);
  }

  for (const corner of CORNERS) {
    const neighbour = at(x + corner.dx, y + corner.dy);
    if (priorityOf(neighbour) <= selfPriority) continue;
    const terrain = baseTerrainOf(neighbour);
    const sides = higherSides.get(terrain);
    const hasA = sides?.has(corner.a) ?? false;
    const hasB = sides?.has(corner.b) ?? false;
    // Both adjacent sides higher: the terrain wraps, so fill the corner generously.
    // Only the diagonal higher: a small nub.
    if (hasA && hasB) add(terrain, `${corner.name}Out`);
    else if (!hasA && !hasB) add(terrain, `${corner.name}In`);
  }

  const fringes: string[] = [];
  const terrains = [...higherSides.keys()].sort((a, b) => PRIORITY[a] - PRIORITY[b]);
  for (const terrain of terrains) {
    for (const edge of [...higherSides.get(terrain)!].sort()) {
      fringes.push(`fringe.${terrain}.${edge}`);
    }
  }

  return { base: `terrain.${baseTerrainOf(self)}.${variantIndex(x, y)}`, fringes };
}

export interface ShorelineTile {
  x: number;
  y: number;
  edges: string[];
}

function isWater(terrain: number): boolean {
  const base = baseTerrainOf(terrain);
  return base === 'deepWater' || base === 'shallowWater';
}

/** Water tiles touching land, with the foam edges that face it. Recomputed on dirty tiles. */
export function shorelineTiles(terrain: TerrainSnapshot): ShorelineTile[] {
  const { tiles, width, height } = terrain;
  const out: ShorelineTile[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const self = tiles[y * width + x];
      if (!isWater(self)) continue;

      const at = (nx: number, ny: number): number =>
        nx < 0 || ny < 0 || nx >= width || ny >= height ? self : tiles[ny * width + nx];

      const landSides = new Set<string>();
      for (const side of SIDES) {
        if (!isWater(at(x + side.dx, y + side.dy))) landSides.add(side.edge);
      }

      const edges = [...landSides].sort().map((edge) => `foam.${edge}`);
      for (const corner of CORNERS) {
        if (landSides.has(corner.a) && landSides.has(corner.b)) {
          edges.push(`foam.${corner.name}Out`);
        }
      }

      if (edges.length > 0) out.push({ x, y, edges });
    }
  }

  return out;
}

export interface TerrainProp {
  x: number;
  y: number;
  /** Atlas key: `prop.cypress` or `prop.peak`. */
  key: string;
}

/** Standing props for Forest (4) and Mountain (6). Not baked — they y-sort on the entity layer. */
export function terrainProps(terrain: TerrainSnapshot): TerrainProp[] {
  const { tiles, width, height } = terrain;
  const out: TerrainProp[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = tiles[y * width + x];
      if (t === 4) out.push({ x, y, key: 'prop.cypress' });
      else if (t === 6) out.push({ x, y, key: 'prop.peak' });
    }
  }
  return out;
}

/**
 * Paint the whole terrain into the offscreen world canvas.
 * Foam is deliberately absent: it animates, so the entity layer draws it per frame.
 */
export function bakeTerrain(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  terrain: TerrainSnapshot,
): void {
  const { tiles, width, height, tileSize } = terrain;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const plan = planTile(tiles, width, height, x, y);
      const dx = x * tileSize;
      const dy = y * tileSize;
      drawCell(ctx, atlas, plan.base, dx, dy, 0, ART_SCALE);
      for (const fringe of plan.fringes) drawCell(ctx, atlas, fringe, dx, dy, 0, ART_SCALE);
    }
  }
}
