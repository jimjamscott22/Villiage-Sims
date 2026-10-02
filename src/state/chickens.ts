/** Mirrors sim/chickens.rs. Seeded state and all timers travel with saves. */
import { findPath, terrainPassable } from './pathfind';
import type { ChickenView, EggBasketView, TerrainSnapshot } from './types';

type Tile = [number, number];
type Activity = 'walking' | 'pecking' | 'scratching' | 'resting' | 'following' | 'returning' | 'sleeping' | 'tilt' | 'scurry' | 'hop';
type Tendency = 'curious' | 'sleepy' | 'social';
export interface Chicken {
  id: number; name: string; tendency: Tendency; x: number; y: number;
  activity: Activity; remaining: number; path: Tile[]; rng: number;
  clickCooldown: number; reactionCooldown: number; soundSeq: number; facingLeft: boolean;
}
export interface Flock {
  shelterId: number; home: Tile; chickens: Chicken[]; baskets: number[];
  nextBasket: number; lastMorning: number; settling: number;
}
export const EGG_FOOD = 3;
const LABELS: Record<Activity, string> = {
  walking: 'investigating a flower', pecking: 'pecking for little treasures',
  scratching: 'scratching the ground', resting: 'taking a little rest',
  following: 'following a friend', returning: 'heading home to roost', sleeping: 'sleeping by the shelter',
  tilt: 'watching a passing villager', scurry: 'scurrying out of the way', hop: 'hopping and clucking',
};
const POSES: Record<Activity, ChickenView['pose']> = {
  walking: 'walk', pecking: 'peck', scratching: 'scratch', resting: 'rest', following: 'walk',
  returning: 'walk', sleeping: 'sleep', tilt: 'tilt', scurry: 'startled', hop: 'hop',
};
const distance = (a: Tile, b: Tile) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
function random(c: Chicken): number {
  let r = c.rng; r ^= r << 13; r ^= r >>> 17; r ^= r << 5; c.rng = r >>> 0; return c.rng;
}
export class ChickenGround {
  constructor(readonly terrain: TerrainSnapshot, readonly occupancy: Array<number | null>) {}
  free = (x: number, y: number): boolean => {
    const { width, height, tiles } = this.terrain;
    return x >= 0 && y >= 0 && x < width && y < height
      && this.occupancy[y * width + x] == null && terrainPassable(tiles[y * width + x]);
  };
  tile = (c: { x: number; y: number }): Tile => [Math.floor(c.x / this.terrain.tileSize), Math.floor(c.y / this.terrain.tileSize)];
  center = (t: Tile): Tile => [(t[0] + 0.5) * this.terrain.tileSize, (t[1] + 0.5) * this.terrain.tileSize];
  local(home: Tile): Tile[] {
    const out: Tile[] = [];
    for (let y = home[1] - 5; y <= home[1] + 5; y++) {
      for (let x = home[0] - 5; x <= home[0] + 5; x++) if (this.free(x, y)) out.push([x, y]);
    }
    return out.sort((a, b) => distance(a, home) - distance(b, home));
  }
  hasExit(home: Tile): boolean {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => this.free(home[0] + d[0], home[1] + d[1]));
  }
}
export function newFlock(shelterId: number, home: Tile, seed: number, date: number, g: ChickenGround): Flock {
  const free = g.local(home);
  const names = ['Pip', 'Mabel', 'Poppy'];
  const tendencies: Tendency[] = ['curious', 'sleepy', 'social'];
  return {
    shelterId, home, baskets: [], nextBasket: 1, lastMorning: date, settling: 1200,
    chickens: names.map((name, i) => {
      const [x, y] = g.center(free[i % free.length]);
      const activity: Activity = i === 2 ? 'scratching' : i === 1 ? 'resting' : 'pecking';
      return { id: i + 1, name, tendency: tendencies[i], x, y, activity, remaining: 40 + i * 35, path: [],
        rng: ((seed ^ Math.imul(shelterId, 2654435761) ^ Math.imul(i + 1, 2246822519)) >>> 0) || 1,
        clickCooldown: 0, reactionCooldown: 100, soundSeq: 0, facingLeft: false };
    }),
  };
}
export function relocateChickens(f: Flock, g: ChickenGround): void {
  const free = g.local(f.home);
  for (const c of f.chickens) {
    const tile = g.tile(c);
    if (!g.free(...tile)) {
      const t = free.reduce<Tile | undefined>((best, t) => !best || distance(t, tile) < distance(best, tile) ? t : best, undefined);
      if (t) [c.x, c.y] = g.center(t);
      c.path = []; c.remaining = 0;
    }
  }
}
export function tickFlock(f: Flock, g: ChickenGround, minute: number, date: number, walkers: Array<{ x: number; y: number }>): void {
  if (minute >= 360 && date !== f.lastMorning) {
    f.lastMorning = date;
    if (f.baskets.length < 3) f.baskets.push(f.nextBasket++);
  }
  const night = minute >= 1080 || (minute < 360 && f.settling === 0);
  f.settling = Math.max(0, f.settling - 1);
  relocateChickens(f, g);
  const free = g.local(f.home);
  const friends = f.chickens.map(g.tile);
  for (const [i, c] of f.chickens.entries()) {
    c.clickCooldown = Math.max(0, c.clickCooldown - 1); c.reactionCooldown = Math.max(0, c.reactionCooldown - 1);
    const tile = g.tile(c);
    if (!free.length) { c.activity = 'resting'; continue; }
    const next = c.path[0];
    if (next && (!g.free(...next) || (next[0] !== tile[0] && next[1] !== tile[1]
      && (!g.free(next[0], tile[1]) || !g.free(tile[0], next[1]))))) { c.path = []; c.remaining = 0; }
    const pathTo = (goal: Tile) => findPath(tile, goal, g.terrain.width, g.terrain.height,
      (x, y) => g.free(x, y) && distance([x, y], f.home) <= 5);
    if (night) {
      if (c.activity === 'hop' && c.remaining > 0) { c.remaining--; continue; }
      if (c.activity === 'sleeping' && distance(tile, f.home) <= 1) continue;
      if (c.activity !== 'returning' && c.activity !== 'sleeping') { c.path = []; c.remaining = 0; }
      if (!c.path.length) {
        let roost: { t: Tile; p: Tile[] } | null = null;
        for (const t of free) {
          const p = pathTo(t);
          if (p) { roost = { t, p }; break; }
        }
        if (roost) {
          if (distance(tile, roost.t) === 0) { c.activity = 'sleeping'; c.remaining = 0; continue; }
          c.path = roost.p;
        }
      }
      c.activity = 'returning';
    } else {
      if (c.activity === 'sleeping' || c.activity === 'returning') { c.remaining = 0; c.path = []; }
      if (c.reactionCooldown === 0 && walkers.some(w => Math.hypot(w.x - c.x, w.y - c.y) < g.terrain.tileSize * 1.3)) {
        c.path = []; c.remaining = 24; c.reactionCooldown = 160;
        c.activity = random(c) % 2 === 0 ? 'tilt' : 'scurry';
        if (c.activity === 'scurry') {
          let away: Tile | null = null, best = -Infinity;
          for (const t of free.filter(t => distance(t, tile) <= 2)) {
            const p = g.center(t);
            const score = Math.min(...walkers.map(w => Math.hypot(p[0] - w.x, p[1] - w.y)));
            if (score >= best) { away = t; best = score; }
          }
          if (away) c.path = pathTo(away) ?? [];
        }
      }
      if (c.remaining === 0 && c.path.length === 0) {
        const r = random(c); c.remaining = 40 + r % 80;
        switch (r % 6) {
          case 0: c.activity = 'resting'; if (c.tendency === 'sleepy') c.remaining += 100; break;
          case 1: c.activity = 'pecking'; break;
          case 2: c.activity = 'scratching'; break;
          default: {
            const radius = c.tendency === 'curious' ? 5 : c.tendency === 'social' ? 2 : 3;
            const candidates = free.filter(t => distance(t, f.home) <= radius);
            const follow = r % 6 === 3 || c.tendency === 'social';
            const goal = follow ? friends[(i + 1) % friends.length] : candidates.length ? candidates[random(c) % candidates.length] : tile;
            c.path = pathTo(goal) ?? []; c.activity = follow ? 'following' : 'walking';
          }
        }
        if (r % 13 === 0) c.soundSeq = (c.soundSeq + 1) >>> 0;
      }
    }
    const waypoint = c.path[0];
    if (waypoint) {
      const target = g.center(waypoint), dx = target[0] - c.x, dy = target[1] - c.y, d = Math.hypot(dx, dy);
      const step = g.terrain.tileSize * (c.activity === 'scurry' ? 0.09 : 0.035);
      if (Math.abs(dx) > 0.01) c.facingLeft = dx < 0;
      if (d <= step) { [c.x, c.y] = target; c.path.shift(); } else { c.x += dx / d * step; c.y += dy / d * step; }
    } else {
      c.remaining = Math.max(0, c.remaining - 1);
      if (c.remaining === 0 && ['walking', 'following', 'scurry'].includes(c.activity)) { c.activity = 'pecking'; c.remaining = 30; }
    }
  }
}
export function clickChicken(f: Flock | null, shelterId: number, id: number): boolean {
  if (!f || f.shelterId !== shelterId) throw new Error('chicken shelter missing');
  const c = f.chickens.find(c => c.id === id);
  if (!c) throw new Error('unknown chicken');
  if (c.clickCooldown) return false;
  c.activity = 'hop'; c.remaining = 14; c.path = []; c.clickCooldown = 100; c.reactionCooldown = 160;
  c.soundSeq = (c.soundSeq + 1) >>> 0; return true;
}
export function collectEggs(f: Flock | null, shelterId: number, id: number): number {
  if (!f || f.shelterId !== shelterId) throw new Error('chicken shelter missing');
  const i = f.baskets.indexOf(id);
  if (i < 0) throw new Error('egg basket already collected or missing');
  f.baskets.splice(i, 1); return EGG_FOOD;
}
export function chickenViews(f: Flock | null): ChickenView[] {
  return f?.chickens.map(c => ({ id: c.id, shelterId: f.shelterId, name: c.name, tendency: c.tendency,
    x: c.x, y: c.y, pose: POSES[c.activity], activity: LABELS[c.activity], soundSeq: c.soundSeq, facingLeft: c.facingLeft })) ?? [];
}
export function basketViews(f: Flock | null, size: number): EggBasketView[] {
  return f?.baskets.map((id, i) => ({ id, shelterId: f.shelterId, x: (f.home[0] + 0.2 + i * 0.3) * size, y: (f.home[1] + 0.85) * size })) ?? [];
}
export function validateFlock(f: Flock, g: ChickenGround): void {
  if (!Array.isArray(f.chickens) || f.chickens.length !== 3 || !Array.isArray(f.baskets) || f.baskets.length > 3
    || !Number.isInteger(f.nextBasket) || f.nextBasket < 1 || f.settling < 0 || f.settling > 1200) throw new Error('save contains invalid flock');
  const ids = new Set<number>();
  for (const c of f.chickens) {
    if (![1, 2, 3].includes(c.id) || ids.has(c.id) || !c.rng || !c.name || !['curious', 'sleepy', 'social'].includes(c.tendency)
      || !(c.activity in LABELS) || !Number.isFinite(c.x) || !Number.isFinite(c.y)
      || c.x < 0 || c.y < 0 || c.x >= g.terrain.width * g.terrain.tileSize || c.y >= g.terrain.height * g.terrain.tileSize
      || distance(g.tile(c), f.home) > 5 || !Array.isArray(c.path)
      || c.path.some(t => distance(t, f.home) > 5 || t[0] < 0 || t[1] < 0 || t[0] >= g.terrain.width || t[1] >= g.terrain.height)) throw new Error('save contains invalid chicken');
    ids.add(c.id);
  }
  if (new Set(f.baskets).size !== f.baskets.length || f.baskets.some(b => !Number.isInteger(b) || b < 1 || b >= f.nextBasket)) throw new Error('save contains invalid baskets');
}
