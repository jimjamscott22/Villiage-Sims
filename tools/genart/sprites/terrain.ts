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
