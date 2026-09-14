import type { DemoVillager } from './demoWorld';
import { DemoLeisure, distance, idle, neighbors, same, type BehaviorHost, type Tile } from './demoLeisure';

export interface Encounter { a: number; b: number; meeting: Tile; waiting: Tile; remaining: number; talking: boolean }
export class DemoSocial {
  encounters: Encounter[] = [];
  readonly leisure: DemoLeisure;
  constructor(readonly host: BehaviorHost) { this.leisure = new DemoLeisure(host); }
  pair(id: number): Encounter | undefined { return this.encounters.find(p => p.a === id || p.b === id); }
  eligible(v: DemoVillager): boolean {
    return v.needs.hunger > 0.25 && v.needs.energy > 0.25 && v.currentJob == null && v.carrying == null
      && !this.pair(v.id) && (this.leisure.behavior[v.id]?.cooldown ?? 0) === 0 && (v.state === 'idle' || this.leisure.active(v));
  }
  reserved(tile: Tile, except: number): boolean {
    return Object.entries(this.leisure.behavior).some(([id, b]) => Number(id) !== except && same(b.destination, tile))
      || this.encounters.some(p => same(p.meeting, tile) || same(p.waiting, tile));
  }
  available(v: DemoVillager): boolean {
    return this.eligible(v) && v.needs.social < 0.85 && this.host.villagers().some(o => o.id !== v.id && this.eligible(o) && distance(this.host.tile(v), this.host.tile(o)) <= 8);
  }
  begin(v: DemoVillager): boolean {
    if (!this.eligible(v)) return false;
    const from = this.host.tile(v);
    const choices: Array<{ other: DemoVillager; meeting: Tile; waiting: Tile; path: Tile[] }> = [];
    for (const other of this.host.villagers()) {
      const waiting = this.host.tile(other);
      if (other.id === v.id || !this.eligible(other) || distance(from, waiting) > 8 || !same([other.x, other.y], this.host.center(waiting)) || this.reserved(waiting, other.id)) continue;
      for (const meeting of neighbors(waiting)) {
        if (!this.host.passable(meeting) || this.reserved(meeting, v.id)
          || this.host.villagers().some(o => o.id !== v.id && same(this.host.tile(o), meeting))
          || !this.leisure.accessAvailable(meeting, t => this.reserved(t, v.id))) continue;
        const path = this.host.path(from, meeting);
        if (path) choices.push({ other, meeting, waiting, path });
      }
    }
    choices.sort((a, b) => a.path.length - b.path.length || a.other.id - b.other.id || a.meeting[0] - b.meeting[0] || a.meeting[1] - b.meeting[1]);
    const c = choices[0];
    if (!c) return false;
    this.leisure.clear(v); this.leisure.clear(c.other);
    if (!c.path.length && !same([v.x, v.y], this.host.center(c.meeting))) c.path.push(c.meeting);
    v.state = 'moving'; v.purpose = 'wander'; v.target = c.meeting; v.path = c.path; v.currentAction = 'socialize';
    idle(c.other); c.other.currentAction = 'socialize';
    this.encounters.push({ a: v.id, b: c.other.id, meeting: c.meeting, waiting: c.waiting, remaining: 200, talking: false });
    return true;
  }
  private finish(p: Encounter, cooldown: number): void {
    for (const id of [p.a, p.b]) {
      const v = this.host.villagers().find(v => v.id === id);
      if (!v) continue;
      if (v.currentAction === 'socialize') { idle(v); v.currentAction = null; v.thought = null; }
      this.leisure.state(id).cooldown = cooldown;
    }
  }
  cancel(id: number): void {
    const p = this.pair(id);
    if (p) { this.encounters = this.encounters.filter(o => o !== p); this.finish(p, p.talking ? 400 : 100); }
  }
  private valid(p: Encounter): boolean {
    return [p.a, p.b].every(id => this.host.villagers().some(v => v.id === id && v.needs.hunger > 0.25 && v.needs.energy > 0.25 && v.currentAction === 'socialize'))
      && this.host.passable(p.meeting) && this.host.passable(p.waiting);
  }
  prepare(): void {
    this.leisure.refresh();
    for (const b of Object.values(this.leisure.behavior)) { b.cooldown = Math.max(0, b.cooldown - 1); b.pause = Math.max(0, b.pause - 1); }
    for (const p of [...this.encounters]) if (!this.valid(p)) this.cancel(p.a);
    for (const v of this.host.villagers()) {
      const b = this.leisure.behavior[v.id];
      if (b?.destination && (!this.host.passable(b.destination) || (b.building != null && !this.leisure.destinations.some(d => d.building === b.building && same(d.tile, b.destination))))) {
        this.leisure.clear(v); idle(v); v.currentAction = null;
      }
    }
  }
  tick(): void {
    const pairs = this.encounters; this.encounters = [];
    for (const p of pairs) {
      if (!this.valid(p)) { this.finish(p, 100); continue; }
      const a = this.host.villagers().find(v => v.id === p.a)!;
      const b = this.host.villagers().find(v => v.id === p.b)!;
      if (p.talking) {
        for (const v of [a, b]) {
          v.needs.social = Math.min(1, v.needs.social + 0.30 / 120);
          v.needs.happiness = (v.needs.hunger + v.needs.energy + v.needs.social) / 3;
        }
        p.remaining--;
      } else if (same([a.x, a.y], this.host.center(p.meeting)) && same([b.x, b.y], this.host.center(p.waiting))) {
        p.talking = true; p.remaining = 120;
        for (const v of [a, b]) { idle(v); v.state = 'socializing'; v.activityTicks = 120; }
      } else p.remaining--;
      if (!p.remaining) this.finish(p, p.talking ? 400 : 100); else this.encounters.push(p);
    }
  }
  label(v: DemoVillager): string | undefined {
    const p = this.pair(v.id);
    if (p) {
      const name = this.host.villagers().find(o => o.id === (p.a === v.id ? p.b : p.a))?.name ?? 'a villager';
      return `${p.talking ? 'Talking to' : p.a === v.id ? 'Meeting' : 'Waiting for'} ${name}`;
    }
    const b = this.leisure.behavior[v.id];
    if (b?.pause) return 'Taking a break';
    if (b?.destination) {
      const building = this.host.buildings().find(o => o.id === b.building);
      return building ? `Heading to the ${building.kind}` : 'Taking a stroll';
    }
  }
  activity(v: DemoVillager): string | undefined {
    const p = this.pair(v.id), b = this.leisure.behavior[v.id];
    return p ? (p.talking ? 'talking' : p.a === v.id ? 'meeting' : 'waiting') : b?.pause ? 'break' : b?.destination ? 'visiting' : undefined;
  }
  validate(): void {
    const ids = new Set<number>(), tiles = new Set<string>();
    const claim = (t: Tile): boolean => {
      if (!Array.isArray(t) || t.length !== 2 || !t.every(Number.isInteger) || t[0] < 0 || t[1] < 0 || t[0] >= this.host.width || t[1] >= this.host.height || tiles.has(t.join(','))) return false;
      tiles.add(t.join(',')); return true;
    };
    for (const p of this.encounters) {
      if (!p || p.a === p.b || ids.has(p.a) || ids.has(p.b) || !claim(p.meeting) || !claim(p.waiting)
        || !Number.isInteger(p.remaining) || p.remaining <= 0 || p.remaining > (p.talking ? 120 : 200)
        || Math.abs(p.meeting[0] - p.waiting[0]) + Math.abs(p.meeting[1] - p.waiting[1]) !== 1
        || ![p.a, p.b].every(id => this.host.villagers().some(v => v.id === id && v.currentAction === 'socialize'))) throw new Error('save contains an invalid social encounter');
      for (const [id, tile] of [[p.a, p.meeting], [p.b, p.waiting]] as Array<[number, Tile]>) {
        const v = this.host.villagers().find(v => v.id === id)!;
        if ((p.talking || id === p.b) && !same([v.x, v.y], this.host.center(tile))) throw new Error('save contains an invalid conversation position');
      }
      ids.add(p.a); ids.add(p.b);
    }
    for (const [id, b] of Object.entries(this.leisure.behavior)) {
      if (!this.host.villagers().some(v => v.id === Number(id)) || !Number.isInteger(b.cooldown) || b.cooldown < 0 || b.cooldown > 400 || !Number.isInteger(b.pause) || b.pause < 0 || b.pause > 80
        || (b.destination != null && !claim(b.destination)) || (b.building != null && b.destination == null)) throw new Error('save contains invalid leisure behavior');
    }
  }
}
