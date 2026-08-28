import type { BuildingDef, CropDef, TickSnapshot } from '../state/types';
import type { Atlas } from './atlas';
import { ART_SCALE, drawCell, frameCount } from './atlas';
import {
  footprintIntersects,
  tileInBounds,
  type TileBounds,
  type TileSpatialIndex,
} from './spatial';
import type { TerrainProp } from './tilemap';

export type Facing = 'n' | 'e' | 's' | 'w';

export interface DrawEntry {
  rank: number;
  baseY: number;
  id: string;
  key: string;
  frame: number;
  x: number;
  y: number;
  /** When true, draw the cell mirrored horizontally (West facing). */
  mirror?: boolean;
  /** Pixel size for selection brackets (`__building_sel__` / `__villager_sel__`). */
  selW?: number;
  selH?: number;
}

export const WALK_TICKS_PER_FRAME = 3;
export const MILL_TICKS_PER_FRAME = 4;
export const SMOKE_TICKS_PER_FRAME = 8;
export const DUST_TICKS_PER_FRAME = 5;
export const SWAY_TICKS_PER_FRAME = 12;

const STATE_MOVING = 1;
const STATE_WORKING = 2;
const STATE_EATING = 3;
const STATE_SLEEPING = 4;
const STATE_SOCIALIZING = 5;

const VILLAGER_NATIVE_H = 24;
const VILLAGER_NATIVE_W = 16;

/** Derive facing from a position delta. Zero delta returns null (caller keeps last facing). */
export function facingFromDelta(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
}

export function dyeIndex(villagerId: number): number {
  return ((villagerId % 6) + 6) % 6;
}

function animFrame(tick: number, period: number, frames: number, reduceMotion: boolean): number {
  if (reduceMotion || frames <= 1) return 0;
  return Math.floor(tick / period) % frames;
}

function footprintOf(def: BuildingDef | undefined, rot: number): [number, number] {
  const [fw, fh] = def?.footprint ?? [1, 1];
  return rot % 2 === 0 ? [fw, fh] : [fh, fw];
}

function spriteKey(def: { id: string; sprite?: string } | undefined, fallback: string): string {
  return def?.sprite ?? def?.id ?? fallback;
}

function scaffoldKey(fw: number, fh: number): string {
  const size = Math.max(fw, fh);
  if (size >= 3) return 'scaffold.3';
  if (size >= 2) return 'scaffold.2';
  return 'scaffold.1';
}

interface BuildingVfx {
  key: string;
  /** Native-art pixel offset from the building footprint origin (top-left tile). */
  offsetX: number;
  offsetY: number;
  period: number;
}

const BUILDING_VFX: Record<string, BuildingVfx> = {
  bakery: { key: 'vfx.smoke', offsetX: 20, offsetY: 2, period: SMOKE_TICKS_PER_FRAME },
  mill: { key: 'vfx.dust', offsetX: 14, offsetY: 50, period: DUST_TICKS_PER_FRAME },
};

function bubbleForState(state: number | undefined): string | null {
  switch (state) {
    case STATE_WORKING:
      return 'bubble.tool';
    case STATE_EATING:
      return 'bubble.fork';
    case STATE_SLEEPING:
      return 'bubble.zzz';
    case STATE_SOCIALIZING:
      return 'bubble.speech';
    default:
      return null;
  }
}

function cellAnchorY(atlas: Atlas, key: string): number {
  return atlas.manifest.cells[key]?.anchorY ?? 0;
}

function cellFrames(atlas: Atlas, key: string): number {
  const cell = atlas.manifest.cells[key];
  return cell ? frameCount(cell) : 1;
}

function hasCell(atlas: Atlas, key: string): boolean {
  return atlas.manifest.cells[key] != null;
}

export interface SceneInput {
  snapshot: TickSnapshot;
  catalog: { buildings: BuildingDef[]; crops: CropDef[] };
  props: TerrainProp[];
  /**
   * Optional spatial index of `props`. When set with `viewTiles`, only props in
   * the visible tile AABB are considered (avoids scanning the full 128×128 set).
   */
  propsIndex?: TileSpatialIndex<TerrainProp>;
  /**
   * Inclusive tile viewport (+ margin). When set, buildings/crops/props/villagers
   * outside the rect are omitted from the draw list.
   */
  viewTiles?: TileBounds;
  tileSize: number;
  tick: number;
  reduceMotion: boolean;
  selectedBuildingId: number | null;
  selectedVillagerId: number | null;
  /** Mutable map retained across frames so idle villagers keep their last facing. */
  lastFacing: Map<number, Facing>;
  atlas: Atlas;
}

/** Stats returned alongside the draw list when callers need perf counters. */
export interface DrawListResult {
  list: DrawEntry[];
  propsDrawn: number;
}

function pushSprite(
  list: DrawEntry[],
  opts: {
    rank: number;
    id: string;
    key: string;
    frame: number;
    tileX: number;
    tileY: number;
    tileSize: number;
    footprintH: number;
    atlas: Atlas;
    mirror?: boolean;
    /** Extra native-art offset from the footprint origin before scaling. */
    offsetX?: number;
    offsetY?: number;
  },
): void {
  if (!hasCell(opts.atlas, opts.key)) return;
  const cell = opts.atlas.manifest.cells[opts.key];
  const anchorY = cellAnchorY(opts.atlas, opts.key);
  const worldX = opts.tileX * opts.tileSize + (opts.offsetX ?? 0) * ART_SCALE;
  const worldY = opts.tileY * opts.tileSize + (opts.offsetY ?? 0) * ART_SCALE;
  const drawY = worldY - anchorY * ART_SCALE;
  const spriteBottom = drawY + cell.h * ART_SCALE;
  const footprintBottom = worldY + opts.footprintH * opts.tileSize;
  list.push({
    rank: opts.rank,
    baseY: Math.max(footprintBottom, spriteBottom),
    id: opts.id,
    key: opts.key,
    frame: opts.frame,
    x: worldX,
    y: drawY,
    mirror: opts.mirror,
  });
}

/** Build a sorted draw list. Pure aside from mutating `lastFacing`. */
export function buildDrawList(input: SceneInput): DrawEntry[] {
  return buildDrawListWithStats(input).list;
}

/** Like `buildDrawList`, but also reports how many props survived culling. */
export function buildDrawListWithStats(input: SceneInput): DrawListResult {
  const {
    snapshot,
    catalog,
    props,
    propsIndex,
    viewTiles,
    tileSize,
    tick,
    reduceMotion,
    selectedBuildingId,
    selectedVillagerId,
    lastFacing,
    atlas,
  } = input;
  const list: DrawEntry[] = [];
  const farmKind = catalog.buildings.findIndex((b) => b.id === 'farm');
  let propsDrawn = 0;

  for (const building of snapshot.buildings) {
    const def = catalog.buildings[building.kind];
    const [fw, fh] = footprintOf(def, building.rot);
    if (viewTiles && !footprintIntersects(building.x, building.y, fw, fh, viewTiles)) continue;

    if (building.kind === farmKind || def?.id === 'farm') {
      pushSprite(list, {
        rank: 0,
        id: `field:${building.id}`,
        key: 'farm.field',
        frame: 0,
        tileX: building.x,
        tileY: building.y,
        tileSize,
        footprintH: fh,
        atlas,
      });
    }

    if (building.state !== 2) {
      pushSprite(list, {
        rank: 1,
        id: `b:${building.id}`,
        key: scaffoldKey(fw, fh),
        frame: 0,
        tileX: building.x,
        tileY: building.y,
        tileSize,
        footprintH: fh,
        atlas,
      });
    } else {
      const key = spriteKey(def, `kind${building.kind}`);
      const frames = cellFrames(atlas, key);
      const period = key === 'mill' ? MILL_TICKS_PER_FRAME : 1;
      pushSprite(list, {
        rank: 1,
        id: `b:${building.id}`,
        key,
        frame: animFrame(tick, period, frames, reduceMotion),
        tileX: building.x,
        tileY: building.y,
        tileSize,
        footprintH: fh,
        atlas,
      });

      const vfx = def?.id ? BUILDING_VFX[def.id] : undefined;
      if (vfx && hasCell(atlas, vfx.key)) {
        const vfxFrames = cellFrames(atlas, vfx.key);
        pushSprite(list, {
          rank: 1,
          id: `vfx:${building.id}`,
          key: vfx.key,
          frame: animFrame(tick, vfx.period, vfxFrames, reduceMotion),
          tileX: building.x,
          tileY: building.y,
          tileSize,
          footprintH: fh,
          atlas,
          offsetX: vfx.offsetX,
          offsetY: vfx.offsetY,
        });
      }
    }

    if (selectedBuildingId != null && building.id === selectedBuildingId) {
      list.push({
        rank: 2,
        baseY: building.y * tileSize + fh * tileSize + 1,
        id: `bsel:${building.id}`,
        key: '__building_sel__',
        frame: 0,
        x: building.x * tileSize,
        y: building.y * tileSize,
        selW: fw * tileSize,
        selH: fh * tileSize,
      });
    }
  }

  for (const crop of snapshot.crops ?? []) {
    if (viewTiles && !tileInBounds(crop.x, crop.y, viewTiles)) continue;
    const def = catalog.crops[crop.kind];
    const base = spriteKey(def, 'wheat');
    const staged = `${base}.${crop.stage}`;
    const key = hasCell(atlas, staged) ? staged : base;
    const frames = cellFrames(atlas, key);
    pushSprite(list, {
      rank: 1,
      id: `c:${crop.id}`,
      key,
      frame: animFrame(tick, SWAY_TICKS_PER_FRAME, frames, reduceMotion),
      tileX: crop.x,
      tileY: crop.y,
      tileSize,
      footprintH: 1,
      atlas,
    });
  }

  // Decor scatter sits on buildable ground, so anything under a footprint is dropped.
  // Terrain-defining props (cypress, peak) are never covered: those tiles aren't buildable.
  // Covered tiles use the full (already viewport-culled) building list so decor under a
  // partially-visible footprint stays suppressed even when only part of the building draws.
  const covered = new Set<string>();
  for (const building of snapshot.buildings) {
    const [fw, fh] = footprintOf(catalog.buildings[building.kind], building.rot);
    for (let dy = 0; dy < fh; dy += 1) {
      for (let dx = 0; dx < fw; dx += 1) covered.add(`${building.x + dx},${building.y + dy}`);
    }
  }

  const pushProp = (prop: TerrainProp) => {
    if (prop.decor && covered.has(`${prop.x},${prop.y}`)) return;
    if (prop.season != null && prop.season !== snapshot.clock.season) return;
    propsDrawn += 1;
    pushSprite(list, {
      rank: 1,
      id: `p:${prop.x},${prop.y}`,
      key: prop.key,
      frame: animFrame(tick, SWAY_TICKS_PER_FRAME, cellFrames(atlas, prop.key), reduceMotion),
      tileX: prop.x,
      tileY: prop.y,
      tileSize,
      footprintH: 1,
      atlas,
    });
  };

  if (propsIndex && viewTiles) {
    propsIndex.forEachInBounds(viewTiles, pushProp);
  } else {
    for (const prop of props) {
      if (viewTiles && !tileInBounds(prop.x, prop.y, viewTiles)) continue;
      pushProp(prop);
    }
  }

  for (const villager of snapshot.villagers) {
    if (viewTiles) {
      const tx = Math.floor(villager.x / tileSize);
      const ty = Math.floor(villager.y / tileSize);
      if (!tileInBounds(tx, ty, viewTiles)) continue;
    }
    const derived = facingFromDelta(villager.dx ?? 0, villager.dy ?? 0);
    const facing: Facing = derived ?? lastFacing.get(villager.id) ?? 's';
    lastFacing.set(villager.id, facing);

    const dye = dyeIndex(villager.id);
    const state = villager.state ?? 0;
    const drawFacing: 'n' | 'e' | 's' = facing === 'w' ? 'e' : facing;
    const mirror = facing === 'w';

    let key: string;
    if (state === STATE_SLEEPING) {
      key = `villager.lie.${dye}`;
    } else if (state === STATE_MOVING) {
      const walk = animFrame(tick, WALK_TICKS_PER_FRAME, 4, false);
      key = `villager.${drawFacing}.walk${walk}.${dye}`;
    } else {
      key = `villager.${drawFacing}.idle.${dye}`;
    }

    if (hasCell(atlas, key)) {
      // Villager x/y are world-pixel feet/center from the sim. Sprite sits so its
      // bottom contact lands near that point.
      const drawX = villager.x - (VILLAGER_NATIVE_W * ART_SCALE) / 2;
      const drawY = villager.y - VILLAGER_NATIVE_H * ART_SCALE + 4;
      list.push({
        rank: 1,
        baseY: villager.y + 4,
        id: `v:${villager.id}`,
        key,
        frame: 0,
        x: drawX,
        y: drawY,
        mirror,
      });
    }

    const bubble = bubbleForState(state);
    if (bubble && hasCell(atlas, bubble)) {
      list.push({
        rank: 2,
        baseY: villager.y + 5,
        id: `vb:${villager.id}`,
        key: bubble,
        frame: 0,
        x: villager.x - 4 * ART_SCALE,
        y: villager.y - VILLAGER_NATIVE_H * ART_SCALE - 4,
      });
    }

    if (selectedVillagerId != null && villager.id === selectedVillagerId) {
      list.push({
        rank: 2,
        baseY: villager.y + 6,
        id: `vsel:${villager.id}`,
        key: '__villager_sel__',
        frame: 0,
        x: villager.x - 10,
        y: villager.y - 22,
        selW: 20,
        selH: 28,
      });
    }
  }

  list.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.baseY !== b.baseY) return a.baseY - b.baseY;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { list, propsDrawn };
}

/** Paint a previously built draw list. */
export function paintScene(ctx: CanvasRenderingContext2D, atlas: Atlas, list: DrawEntry[]): void {
  const hasUiBrackets = atlas.manifest.cells['ui.bracket.tl'] != null;

  for (const entry of list) {
    if (entry.key === '__building_sel__' || entry.key === '__villager_sel__') {
      drawSelectionBrackets(
        ctx,
        atlas,
        entry.x,
        entry.y,
        entry.selW ?? 16,
        entry.selH ?? 16,
        hasUiBrackets,
      );
      continue;
    }
    if (entry.key.startsWith('__')) continue;

    if (entry.mirror) {
      const cell = atlas.manifest.cells[entry.key];
      if (!cell) continue;
      ctx.save();
      ctx.translate(entry.x + cell.w * ART_SCALE, entry.y);
      ctx.scale(-1, 1);
      drawCell(ctx, atlas, entry.key, 0, 0, entry.frame, ART_SCALE);
      ctx.restore();
    } else {
      drawCell(ctx, atlas, entry.key, entry.x, entry.y, entry.frame, ART_SCALE);
    }
  }
}

function drawSelectionBrackets(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  x: number,
  y: number,
  w: number,
  h: number,
  useAtlas: boolean,
): void {
  if (useAtlas) {
    const size = 8 * ART_SCALE;
    const corners: Array<{ key: string; dx: number; dy: number }> = [
      { key: 'ui.bracket.tl', dx: x, dy: y },
      { key: 'ui.bracket.tr', dx: x + w - size, dy: y },
      { key: 'ui.bracket.bl', dx: x, dy: y + h - size },
      { key: 'ui.bracket.br', dx: x + w - size, dy: y + h - size },
    ];
    for (const corner of corners) {
      drawCell(ctx, atlas, corner.key, corner.dx, corner.dy, 0, ART_SCALE);
    }
    return;
  }

  const len = Math.min(8, w / 3, h / 3);
  ctx.strokeStyle = '#f4c95d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - len);
  ctx.stroke();
}

/** Whether the atlas has entity art (vs a terrain-only Phase 1 atlas). */
export function atlasHasEntities(atlas: Atlas): boolean {
  return atlas.manifest.sheets.entities != null && atlas.manifest.cells.hut != null;
}
