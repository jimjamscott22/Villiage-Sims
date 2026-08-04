import type { SpriteGrid } from './grid';
import { rasterizeGrid, remapColor } from './grid';
import type { PackItem } from './pack';
import { pack } from './pack';
import { Raster } from './raster';
import { BUILDING_SPRITES } from './sprites/buildings';
import { CROP_SPRITES } from './sprites/crops';
import { PROP_SPRITES } from './sprites/props';
import {
  BASE_TERRAINS,
  EDGES,
  FOAM_EDGES,
  FOAM_FRAMES,
  VARIANTS,
  makeBaseTile,
  makeFoam,
  makeFringe,
} from './sprites/terrain';
import {
  BUBBLES,
  DYE_PLACEHOLDER,
  VILLAGER_DYES,
  VILLAGER_POSES,
} from './sprites/villagers';

export const SHEET_WIDTH = 256;

export interface AtlasCellDef {
  sheet: string;
  x: number;
  y: number;
  /** Width of a single frame. */
  w: number;
  h: number;
  /** Pixels of sprite above the footprint. Absent means zero. */
  anchorY?: number;
  /** Frame count; frames are laid out horizontally. Absent means one. */
  frames?: number;
}

export interface AtlasManifest {
  sheets: Record<string, string>;
  cells: Record<string, AtlasCellDef>;
}

export interface BuiltSheet {
  name: string;
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface BuiltAtlas {
  sheets: BuiltSheet[];
  manifest: AtlasManifest;
}

interface Source {
  key: string;
  frames: Raster[];
  anchorY?: number;
}

function terrainSources(): Source[] {
  const sources: Source[] = [];

  for (const terrain of BASE_TERRAINS) {
    for (let variant = 0; variant < VARIANTS; variant += 1) {
      sources.push({ key: `terrain.${terrain}.${variant}`, frames: [makeBaseTile(terrain, variant)] });
    }
  }

  for (const terrain of BASE_TERRAINS) {
    for (const edge of EDGES) {
      sources.push({ key: `fringe.${terrain}.${edge}`, frames: [makeFringe(terrain, edge)] });
    }
  }

  for (const edge of FOAM_EDGES) {
    const frames = Array.from({ length: FOAM_FRAMES }, (_, frame) => makeFoam(edge, frame));
    sources.push({ key: `foam.${edge}`, frames });
  }

  return sources;
}

function fromSprite(
  key: string,
  entry: { grid: SpriteGrid; anchorY: number; frames?: SpriteGrid[] },
): Source {
  const frames = (entry.frames ?? [entry.grid]).map(rasterizeGrid);
  return { key, frames, anchorY: entry.anchorY };
}

function entitySources(): Source[] {
  const sources: Source[] = [];

  for (const [key, entry] of Object.entries(BUILDING_SPRITES)) {
    sources.push(fromSprite(key, entry));
  }
  for (const [key, entry] of Object.entries(CROP_SPRITES)) {
    if (key === 'wheat') continue; // stage keys are the real cells; id fallback is runtime-only
    sources.push(fromSprite(key, entry));
  }
  for (const [key, entry] of Object.entries(PROP_SPRITES)) {
    sources.push(fromSprite(key, entry));
  }

  for (const [poseKey, grid] of Object.entries(VILLAGER_POSES)) {
    const base = rasterizeGrid(grid);
    VILLAGER_DYES.forEach((dye, dyeIndex) => {
      const frames = [remapColor(base, DYE_PLACEHOLDER, dye)];
      sources.push({
        key: `villager.${poseKey}.${dyeIndex}`,
        frames,
        anchorY: 8,
      });
    });
  }

  for (const [key, grid] of Object.entries(BUBBLES)) {
    sources.push({ key, frames: [rasterizeGrid(grid)], anchorY: 0 });
  }

  return sources;
}

function packSheet(name: string, sources: Source[]): { sheet: BuiltSheet; cells: Record<string, AtlasCellDef> } {
  const items: PackItem[] = sources.map((source) => ({
    key: source.key,
    width: source.frames[0].width * source.frames.length,
    height: source.frames[0].height,
  }));

  const { cells, height } = pack(items, SHEET_WIDTH);
  const sheetRaster = new Raster(SHEET_WIDTH, height);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const manifestCells: Record<string, AtlasCellDef> = {};

  for (const cell of cells) {
    const source = byKey.get(cell.key);
    if (!source) throw new Error(`Packed cell ${cell.key} has no source`);
    source.frames.forEach((frame, index) => {
      sheetRaster.blit(frame, cell.x + index * frame.width, cell.y);
    });
    const def: AtlasCellDef = {
      sheet: name,
      x: cell.x,
      y: cell.y,
      w: source.frames[0].width,
      h: source.frames[0].height,
    };
    if (source.frames.length > 1) def.frames = source.frames.length;
    if (source.anchorY) def.anchorY = source.anchorY;
    manifestCells[cell.key] = def;
  }

  return {
    sheet: { name, width: SHEET_WIDTH, height, rgba: sheetRaster.rgba },
    cells: manifestCells,
  };
}

/** Rasterize every sprite, pack into sheets, and describe them in a manifest. */
export function buildAtlas(): BuiltAtlas {
  const tiles = packSheet('tiles', terrainSources());
  const entities = packSheet('entities', entitySources());

  const merged: Record<string, AtlasCellDef> = { ...tiles.cells, ...entities.cells };
  const sortedCells: Record<string, AtlasCellDef> = {};
  for (const key of Object.keys(merged).sort()) sortedCells[key] = merged[key];

  return {
    sheets: [tiles.sheet, entities.sheet],
    manifest: {
      sheets: { tiles: 'tiles.png', entities: 'entities.png' },
      cells: sortedCells,
    },
  };
}
