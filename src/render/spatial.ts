/** Inclusive tile AABB used for viewport culling. */
export interface TileBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Default prop/shoreline grid cell size in tiles (16×16 = 512px at 32px tiles). */
export const SPATIAL_CELL_TILES = 16;

/** Extra tiles around the camera so tall sprites aren't clipped at the edge. */
export const VIEW_CULL_MARGIN_TILES = 2;

/** Convert a world-pixel camera rect into inclusive tile bounds with margin. */
export function visibleTileBounds(
  world: WorldRect,
  tileSize: number,
  marginTiles = VIEW_CULL_MARGIN_TILES,
): TileBounds {
  return {
    minX: Math.floor(world.x / tileSize) - marginTiles,
    minY: Math.floor(world.y / tileSize) - marginTiles,
    maxX: Math.ceil((world.x + world.w) / tileSize) + marginTiles,
    maxY: Math.ceil((world.y + world.h) / tileSize) + marginTiles,
  };
}

/** True when a tile footprint overlaps inclusive bounds. */
export function footprintIntersects(
  x: number,
  y: number,
  fw: number,
  fh: number,
  bounds: TileBounds,
): boolean {
  return x + fw > bounds.minX && x <= bounds.maxX && y + fh > bounds.minY && y <= bounds.maxY;
}

/** True when a single tile lies inside inclusive bounds. */
export function tileInBounds(x: number, y: number, bounds: TileBounds): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

/**
 * Uniform grid index over tile-coordinate items. Built once after terrain load;
 * queried each frame for the visible tile AABB.
 */
export class TileSpatialIndex<T extends { x: number; y: number }> {
  readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();

  constructor(cellSize = SPATIAL_CELL_TILES) {
    this.cellSize = cellSize;
  }

  get size(): number {
    let n = 0;
    for (const bucket of this.cells.values()) n += bucket.length;
    return n;
  }

  clear(): void {
    this.cells.clear();
  }

  build(items: readonly T[]): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  insert(item: T): void {
    const key = this.cellKey(item.x, item.y);
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(item);
    else this.cells.set(key, [item]);
  }

  /** Visit items whose tile lies inside `bounds` (exact filter after cell lookup). */
  forEachInBounds(bounds: TileBounds, fn: (item: T) => void): void {
    const minCX = Math.floor(bounds.minX / this.cellSize);
    const maxCX = Math.floor(bounds.maxX / this.cellSize);
    const minCY = Math.floor(bounds.minY / this.cellSize);
    const maxCY = Math.floor(bounds.maxY / this.cellSize);
    for (let cy = minCY; cy <= maxCY; cy += 1) {
      for (let cx = minCX; cx <= maxCX; cx += 1) {
        const bucket = this.cells.get(packCell(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (!tileInBounds(item.x, item.y, bounds)) continue;
          fn(item);
        }
      }
    }
  }

  query(bounds: TileBounds): T[] {
    const out: T[] = [];
    this.forEachInBounds(bounds, (item) => out.push(item));
    return out;
  }

  private cellKey(tx: number, ty: number): number {
    return packCell(Math.floor(tx / this.cellSize), Math.floor(ty / this.cellSize));
  }
}

function packCell(cx: number, cy: number): number {
  return ((cx + 0x8000) << 16) | ((cy + 0x8000) & 0xffff);
}

/**
 * Source/dest rect for blitting only the visible slice of a full-world terrain layer.
 * Coordinates are world pixels; clamped to the layer size.
 */
export function terrainBlitRect(
  view: WorldRect,
  worldWidth: number,
  worldHeight: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  const x0 = Math.floor(view.x);
  const y0 = Math.floor(view.y);
  const x1 = Math.ceil(view.x + view.w);
  const y1 = Math.ceil(view.y + view.h);
  const sx = Math.max(0, x0);
  const sy = Math.max(0, y0);
  const right = Math.min(worldWidth, x1);
  const bottom = Math.min(worldHeight, y1);
  const sw = right - sx;
  const sh = bottom - sy;
  if (sw <= 0 || sh <= 0) return null;
  return { sx, sy, sw, sh };
}
