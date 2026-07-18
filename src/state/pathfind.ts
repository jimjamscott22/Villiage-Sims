/** Terrain bytes matching Rust `Terrain` enum order. */
const IMPASSABLE = new Set([0, 1, 5, 6]); // deep_water, shallow_water, rock, mountain

const ORTHO_COST = 1000;
const DIAG_COST = 1414;
const MAX_EXPANSIONS = 4000;

const DELTAS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function pack(x: number, y: number): number {
  return ((y & 0xffff) << 16) | (x & 0xffff);
}

function unpack(p: number): [number, number] {
  return [p & 0xffff, (p >>> 16) & 0xffff];
}

function heuristic(x: number, y: number, gx: number, gy: number): number {
  const dx = Math.abs(x - gx);
  const dy = Math.abs(y - gy);
  const diag = Math.min(dx, dy);
  const ortho = Math.max(dx, dy) - diag;
  return diag * DIAG_COST + ortho * ORTHO_COST;
}

export function terrainPassable(tile: number): boolean {
  return !IMPASSABLE.has(tile);
}

/**
 * 8-directional A* with no corner-cutting. Returns remaining waypoints after start
 * (empty array when already at goal with no travel needed — start==goal returns [[sx,sy]]
 * so the agent snaps to the tile center). `null` means no path / expansion cap.
 */
export function findPath(
  start: [number, number],
  goal: [number, number],
  width: number,
  height: number,
  passable: (x: number, y: number) => boolean,
): Array<[number, number]> | null {
  const [sx, sy] = start;
  const [gx, gy] = goal;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  if (!inBounds(sx, sy) || !inBounds(gx, gy) || !passable(sx, sy) || !passable(gx, gy)) {
    return null;
  }
  if (sx === gx && sy === gy) return [[sx, sy]];

  const startKey = pack(sx, sy);
  const goalKey = pack(gx, gy);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[startKey, 0]]);
  // open: [f, packedKey]
  const open: Array<[number, number]> = [[heuristic(sx, sy, gx, gy), startKey]];
  const inOpen = new Set<number>([startKey]);
  let expansions = 0;

  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [, current] = open.shift()!;
    inOpen.delete(current);
    expansions += 1;
    if (expansions > MAX_EXPANSIONS) return null;

    if (current === goalKey) {
      const path: Array<[number, number]> = [];
      let cursor: number | undefined = current;
      while (cursor != null && cursor !== startKey) {
        path.push(unpack(cursor));
        cursor = cameFrom.get(cursor);
      }
      path.reverse();
      return path;
    }

    const [cx, cy] = unpack(current);
    const currentG = gScore.get(current) ?? 0;

    for (const [dx, dy] of DELTAS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny) || !passable(nx, ny)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!passable(cx + dx, cy) || !passable(cx, cy + dy))) continue;
      const step = diagonal ? DIAG_COST : ORTHO_COST;
      const nk = pack(nx, ny);
      const tentative = currentG + step;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      cameFrom.set(nk, current);
      gScore.set(nk, tentative);
      if (!inOpen.has(nk)) {
        open.push([tentative + heuristic(nx, ny, gx, gy), nk]);
        inOpen.add(nk);
      }
    }
  }
  return null;
}
