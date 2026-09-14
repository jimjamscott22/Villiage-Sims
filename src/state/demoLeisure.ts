import type { DemoVillager } from './demoWorld';

export type Tile = [number, number];
export const same = (a: Tile | null, b: Tile | null): boolean => a != null && b != null && a[0] === b[0] && a[1] === b[1];
export const distance = (a: Tile, b: Tile): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
export const neighbors = ([x, y]: Tile): Tile[] => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
export interface Behavior {
  cooldown: number; destination: Tile | null; building: number | null;
  previous: Tile | null; visits: number; pause: number;
}
export interface LeisureBuilding { id: number; kind: string; footprint: Tile[]; complete: boolean }
export interface BehaviorHost {
  villagers(): DemoVillager[];
  buildings(): LeisureBuilding[];
  width: number; height: number; seed: number;
  tick(): number;
  tile(v: DemoVillager): Tile;
  center(t: Tile): Tile;
  passable(t: Tile): boolean;
  path(from: Tile, to: Tile): Tile[] | null;
  wander(from: Tile, tick: number, id: number): Tile | null;
}
interface Destination { tile: Tile; building: number; density: number }
const key = (t: Tile): string => t.join(',');
const hash = (t: Tile, salt: number): number => (Math.imul(t[0], 73856093) ^ Math.imul(t[1], 19349663) ^ Math.imul(salt, 83492791)) >>> 0;
const compareTile = (a: Tile, b: Tile): number => a[0] - b[0] || a[1] - b[1];

export class DemoLeisure {
  behavior: Record<number, Behavior> = {};
  destinations: Destination[] = [];
  private signature = '';
  private components: number[] = [];
  private huts: Array<{ footprint: Tile[]; components: Set<number> }> = [];
  constructor(readonly host: BehaviorHost) {}
  state(id: number): Behavior {
    return this.behavior[id] ??= { cooldown: 0, destination: null, building: null, previous: null, visits: 0, pause: 0 };
  }
  refresh(): void {
    const buildings = this.host.buildings();
    const signature = JSON.stringify(buildings);
    if (signature === this.signature) return;
    this.signature = signature;
    const { width, height } = this.host;
    this.components = new Array<number>(width * height).fill(0);
    let component = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (this.components[y * width + x] || !this.host.passable([x, y])) continue;
      component++;
      const queue: Tile[] = [[x, y]];
      this.components[y * width + x] = component;
      for (let i = 0; i < queue.length; i++) for (const t of neighbors(queue[i])) {
        if (!this.host.passable(t)) continue;
        const offset = t[1] * width + t[0];
        if (!this.components[offset]) { this.components[offset] = component; queue.push(t); }
      }
    }
    this.huts = []; this.destinations = [];
    for (const b of buildings) {
      if (!b.complete || !['hut', 'well'].includes(b.kind)) continue;
      const perimeter = new Map<string, Tile>();
      for (const t of b.footprint) for (const n of neighbors(t)) if (this.host.passable(n)) perimeter.set(key(n), n);
      if (b.kind === 'hut') this.huts.push({ footprint: b.footprint, components: new Set([...perimeter.values()].map(t => this.components[t[1] * width + t[0]])) });
      this.destinations.push(...[...perimeter.values()].sort(compareTile).map(tile => ({ tile, building: b.id, density: 0 })));
    }
    for (const d of this.destinations) d.density = this.density(d.tile);
  }
  connected(from: Tile, to: Tile): boolean {
    if (from[0] < 0 || from[1] < 0 || to[0] < 0 || to[1] < 0 || from[0] >= this.host.width || from[1] >= this.host.height || to[0] >= this.host.width || to[1] >= this.host.height) return false;
    if (!this.components.length) return this.host.path(from, to) != null;
    const a = this.components[from[1] * this.host.width + from[0]], b = this.components[to[1] * this.host.width + to[0]];
    return a !== 0 && a === b;
  }
  density(tile: Tile): number {
    const component = this.components[tile[1] * this.host.width + tile[0]];
    return Math.min(5, this.huts.filter(h => h.components.has(component) && h.footprint.some(t => distance(tile, t) <= 8)).length);
  }
  clear(v: DemoVillager): void { const b = this.state(v.id); b.destination = null; b.building = null; b.pause = 0; }
  active(v: DemoVillager): boolean { return (v.state === 'moving' && v.purpose === 'wander') || (this.behavior[v.id]?.pause ?? 0) > 0; }
  committed(v: DemoVillager): boolean { const b = this.behavior[v.id]; return b?.destination != null && (b.pause > 0 || v.state === 'moving'); }
  arrive(v: DemoVillager): void { const b = this.state(v.id); b.pause = 80; b.previous = b.destination; }
  accessAvailable(tile: Tile, reserved: (t: Tile) => boolean): boolean {
    return this.destinations.filter(d => same(d.tile, tile)).every(d => this.destinations.some(o => o.building === d.building && !same(o.tile, tile) && !reserved(o.tile)));
  }
  begin(v: DemoVillager, reserved: (t: Tile) => boolean): void {
    const from = this.host.tile(v), b = this.state(v.id);
    const salt = (this.host.seed + Math.imul(v.id, 31) + Math.imul(b.visits, 17)) >>> 0;
    const score = (d: Destination, length: number): number => (1 + 0.15 * d.density) / (1 + 0.1 * length);
    const priority = (a: Destination, c: Destination): number => Number(same(a.tile, b.previous)) - Number(same(c.tile, b.previous));
    const rough = (d: Destination): number => score(d, Math.abs(from[0] - d.tile[0]) + Math.abs(from[1] - d.tile[1]));
    const candidates = this.destinations.filter(d => distance(from, d.tile) <= 16 && !same(from, d.tile) && !reserved(d.tile) && this.accessAvailable(d.tile, reserved) && !this.host.villagers().some(o => o.id !== v.id && same(this.host.tile(o), d.tile)))
      .sort((a, c) => priority(a, c) || rough(c) - rough(a) || hash(a.tile, salt) - hash(c.tile, salt) || compareTile(a.tile, c.tile)).slice(0, 8);
    const routes = candidates.flatMap(d => { const path = this.host.path(from, d.tile); return path ? [{ d, path, score: score(d, path.length) }] : []; })
      .sort((a, c) => priority(a.d, c.d) || c.score - a.score || hash(a.d.tile, salt) - hash(c.d.tile, salt));
    let choice: { tile: Tile; building: number | null; path: Tile[] } | null = routes[0] ? { ...routes[0].d, path: routes[0].path } : null;
    if (!choice) for (let attempt = 0; attempt < 8; attempt++) {
      const tile = this.host.wander(from, this.host.tick() + b.visits + attempt, v.id);
      if (!tile || same(tile, from) || same(tile, b.previous) || reserved(tile) || !this.accessAvailable(tile, reserved)) continue;
      const path = this.host.path(from, tile);
      if (path) { choice = { tile, building: null, path }; break; }
    }
    this.clear(v); v.currentAction = 'wander';
    if (choice) {
      b.destination = choice.tile; b.building = choice.building; b.visits = (b.visits + 1) >>> 0;
      v.state = 'moving'; v.purpose = 'wander'; v.target = choice.tile; v.path = choice.path;
    } else { idle(v); v.repathCooldown = 20; }
  }
}

export function idle(v: DemoVillager): void { v.state = 'idle'; v.path = null; v.target = null; v.purpose = null; }
