import { hash01 } from '../hash';
import type { PaletteName } from '../palette';
import { toRgba } from '../palette';
import { Raster } from '../raster';

export const TILE = 16;
export const VARIANTS = 4;

export type BaseTerrain = 'deepWater' | 'shallowWater' | 'sand' | 'grass' | 'rock';

export const BASE_TERRAINS: readonly BaseTerrain[] = [
  'deepWater',
  'shallowWater',
  'sand',
  'grass',
  'rock',
];

interface Material {
  base: PaletteName;
  shade: PaletteName;
  hilite: PaletteName;
  /** Fraction of pixels darkened. Highlights use 60% of this. */
  speckle: number;
  /** Distinguishes terrains in the hash so two materials never share a pattern. */
  salt: number;
}

export const MATERIALS: Record<BaseTerrain, Material> = {
  deepWater: { base: 'seaDeep', shade: 'seaDeepest', hilite: 'seaMid', speckle: 0.1, salt: 11 },
  shallowWater: { base: 'seaShallow', shade: 'seaMid', hilite: 'foam', speckle: 0.07, salt: 23 },
  sand: { base: 'sandLight', shade: 'sandMid', hilite: 'sandPale', speckle: 0.14, salt: 37 },
  grass: { base: 'vegLight', shade: 'vegMid', hilite: 'vegPale', speckle: 0.18, salt: 53 },
  rock: { base: 'stoneLight', shade: 'stoneShadow', hilite: 'stonePale', speckle: 0.16, salt: 71 },
};

/** A flat material field, dithered so the tilemap does not read as flat color. */
export function makeBaseTile(terrain: BaseTerrain, variant: number): Raster {
  const material = MATERIALS[terrain];
  const tile = new Raster(TILE, TILE);
  const base = toRgba(material.base);
  const shade = toRgba(material.shade);
  const hilite = toRgba(material.hilite);
  const salt = material.salt + variant * 101;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const value = hash01(x, y, salt);
      if (value < material.speckle) tile.set(x, y, shade);
      else if (value > 1 - material.speckle * 0.6) tile.set(x, y, hilite);
      else tile.set(x, y, base);
    }
  }
  return tile;
}

export type Edge =
  | 'n' | 'e' | 's' | 'w'
  | 'nwOut' | 'neOut' | 'seOut' | 'swOut'
  | 'nwIn' | 'neIn' | 'seIn' | 'swIn';

export const EDGES: readonly Edge[] = [
  'n', 'e', 's', 'w',
  'nwOut', 'neOut', 'seOut', 'swOut',
  'nwIn', 'neIn', 'seIn', 'swIn',
];

export const FOAM_EDGES: readonly Edge[] = ['n', 'e', 's', 'w', 'nwOut', 'neOut', 'seOut', 'swOut'];

export const FOAM_FRAMES = 3;

/** Distance from each of the four tile borders, in pixels. */
function borderDistance(x: number, y: number) {
  return { north: y, east: TILE - 1 - x, south: TILE - 1 - y, west: x };
}

/**
 * Depth of the fringe at a position along a border, in pixels.
 * `along` is the coordinate running parallel to the border, so the jitter
 * varies across the edge and the boundary reads as irregular rather than ruled.
 */
function depthAt(along: number, salt: number, min: number, range: number): number {
  return min + Math.floor(hash01(along, 0, salt) * range);
}

/**
 * How each edge shape combines the four border reaches.
 * Keyed by `Edge`, so omitting a shape is a compile error rather than a silent
 * fall-through. Unused parameters are underscore-prefixed to satisfy
 * `noUnusedParameters`.
 */
const EDGE_SHAPES: Record<Edge, (n: boolean, e: boolean, s: boolean, w: boolean) => boolean> = {
  n: (n) => n,
  e: (_n, e) => e,
  s: (_n, _e, s) => s,
  w: (_n, _e, _s, w) => w,
  // Outer: the higher terrain wraps the corner, so either side reaching is enough.
  nwOut: (n, _e, _s, w) => n || w,
  neOut: (n, e) => n || e,
  seOut: (_n, e, s) => s || e,
  swOut: (_n, _e, s, w) => s || w,
  // Inner: only the diagonal neighbour is higher, so just a nub where both reach.
  nwIn: (n, _e, _s, w) => n && w,
  neIn: (n, e) => n && e,
  seIn: (_n, e, s) => s && e,
  swIn: (_n, _e, s, w) => s && w,
};

/** Is this pixel inside the given edge shape? */
function inEdge(edge: Edge, x: number, y: number, salt: number, min: number, range: number): boolean {
  const d = borderDistance(x, y);
  return EDGE_SHAPES[edge](
    d.north < depthAt(x, salt, min, range),
    d.east < depthAt(y, salt + 1, min, range),
    d.south < depthAt(x, salt + 2, min, range),
    d.west < depthAt(y, salt + 3, min, range),
  );
}

/** Is this pixel on the outermost row of the shape — the lip that catches shadow? */
function isLip(edge: Edge, x: number, y: number, salt: number, min: number, range: number): boolean {
  if (!inEdge(edge, x, y, salt, min, range)) return false;
  const neighbours: Array<[number, number]> = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
  return neighbours.some(([nx, ny]) => {
    if (nx < 0 || ny < 0 || nx >= TILE || ny >= TILE) return false;
    return !inEdge(edge, nx, ny, salt, min, range);
  });
}

const FRINGE_MIN = 3;
const FRINGE_RANGE = 3;

/** The higher terrain spilling onto a lower neighbour, with a shaded lip. */
export function makeFringe(terrain: BaseTerrain, edge: Edge): Raster {
  const material = MATERIALS[terrain];
  const raster = new Raster(TILE, TILE);
  const base = toRgba(material.base);
  const shade = toRgba(material.shade);
  const salt = material.salt * 7 + 13;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (!inEdge(edge, x, y, salt, FRINGE_MIN, FRINGE_RANGE)) continue;
      raster.set(x, y, isLip(edge, x, y, salt, FRINGE_MIN, FRINGE_RANGE) ? shade : base);
    }
  }
  return raster;
}

const FOAM_MIN = 1;
const FOAM_RANGE = 2;

/** A thin shimmering band on the water side of a shoreline. */
export function makeFoam(edge: Edge, frame: number): Raster {
  const raster = new Raster(TILE, TILE);
  const bright = toRgba('foam');
  const soft = toRgba('seaShallow');
  const salt = 907 + frame * 131;

  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (!inEdge(edge, x, y, salt, FOAM_MIN, FOAM_RANGE)) continue;
      raster.set(x, y, isLip(edge, x, y, salt, FOAM_MIN, FOAM_RANGE) ? bright : soft);
    }
  }
  return raster;
}
