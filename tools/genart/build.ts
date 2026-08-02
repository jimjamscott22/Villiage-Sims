import type { PackItem } from './pack';
import { pack } from './pack';
import { Raster } from './raster';
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

/** Rasterize every sprite, pack it into one sheet, and describe it in a manifest. */
export function buildAtlas(): BuiltAtlas {
  const sources = terrainSources();

  const items: PackItem[] = sources.map((source) => ({
    key: source.key,
    width: source.frames[0].width * source.frames.length,
    height: source.frames[0].height,
  }));

  const { cells, height } = pack(items, SHEET_WIDTH);
  const sheet = new Raster(SHEET_WIDTH, height);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const manifestCells: Record<string, AtlasCellDef> = {};

  for (const cell of cells) {
    const source = byKey.get(cell.key);
    if (!source) throw new Error(`Packed cell ${cell.key} has no source`);
    source.frames.forEach((frame, index) => {
      sheet.blit(frame, cell.x + index * frame.width, cell.y);
    });
    const def: AtlasCellDef = {
      sheet: 'tiles',
      x: cell.x,
      y: cell.y,
      w: source.frames[0].width,
      h: source.frames[0].height,
    };
    if (source.frames.length > 1) def.frames = source.frames.length;
    manifestCells[cell.key] = def;
  }

  // Sort keys so the committed manifest has a stable, reviewable order.
  const sortedCells: Record<string, AtlasCellDef> = {};
  for (const key of Object.keys(manifestCells).sort()) sortedCells[key] = manifestCells[key];

  return {
    sheets: [{ name: 'tiles', width: SHEET_WIDTH, height, rgba: sheet.rgba }],
    manifest: { sheets: { tiles: 'tiles.png' }, cells: sortedCells },
  };
}
