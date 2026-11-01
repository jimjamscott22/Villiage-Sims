import { describe, expect, it } from 'vitest';
import { DemoWorld } from './demoWorld';
import { ChickenGround, tickFlock } from './chickens';
import { hoverTargetAt } from '../render/hover';
import { DEMO_CATALOG } from './demoWorld';

const terrain = () => ({ width: 20, height: 20, tileSize: 32, tiles: Array<number>(400).fill(3) });
function world() {
  const w = new DemoWorld(terrain()); w.placeBuilding('chicken_shelter', 10, 10, 0); return w;
}
function atTime(w: DemoWorld, minute: number, day = 1): DemoWorld {
  const saved = JSON.parse(w.exportState()); saved.clock.minute = minute; saved.clock.minuteAccum = minute; saved.clock.day = day;
  // Isolate the ambient feature from villagers consuming food or reacting during these tests.
  saved.villagers = []; saved.jobs = []; saved.encounters = []; saved.behavior = {}; saved.nodes = [];
  return DemoWorld.importState(JSON.stringify(saved));
}
describe('small optional chicken flock', () => {
  it('starts with three named personalities and limits the village to one shelter', () => {
    const w = world();
    expect(w.snapshot().chickens?.map(c => [c.name, c.tendency])).toEqual([['Pip', 'curious'], ['Mabel', 'sleepy'], ['Poppy', 'social']]);
    expect(w.validatePlacement('chicken_shelter', 3, 3, 0).valid).toBe(false);
    const id = w.flock!.shelterId; w.demolish(id);
    expect(w.snapshot().chickens).toEqual([]); expect(w.snapshot().eggBaskets).toEqual([]);
    w.placeBuilding('chicken_shelter', 3, 3, 0);
    expect(() => w.clickChicken(id, 1)).toThrow('chicken shelter missing');
  });
  it('shows several recognizable activities within the first minute', () => {
    const w = world(), poses = new Set<string>();
    for (let t = 0; t < 1200; t++) for (const c of w.advance().chickens ?? []) poses.add(c.pose);
    expect(poses.has('walk')).toBe(true); expect(poses.has('peck')).toBe(true); expect(poses.has('scratch')).toBe(true);
  });
  it('avoids water and buildings, stays near home, and returns at dusk', () => {
    let w = atTime(world(), 480);
    for (let y = 7; y < 14; y++) w.terrain.tiles[y * 20 + 12] = 1;
    w.placeBuilding('hut', 8, 9, 0);
    const saved = JSON.parse(w.exportState());
    const ground = new ChickenGround(w.terrain, saved.occupancy);
    for (let t = 0; t < 1200; t++) for (const c of w.advance().chickens ?? []) {
      expect(ground.free(...ground.tile(c))).toBe(true);
      expect(Math.max(Math.abs(Math.floor(c.x / 32) - 10), Math.abs(Math.floor(c.y / 32) - 10))).toBeLessThanOrEqual(5);
    }
    w = atTime(w, 1080);
    for (let i = 0; i < 700; i++) w.advance();
    expect(w.snapshot().chickens?.every(c => c.pose === 'sleep')).toBe(true);
    for (const c of w.snapshot().chickens ?? []) expect(Math.max(Math.abs(Math.floor(c.x / 32) - 10), Math.abs(Math.floor(c.y / 32) - 10))).toBeLessThanOrEqual(1);
    w = atTime(w, 360, 2); w.advance(); expect(w.snapshot().chickens?.every(c => c.pose !== 'sleep')).toBe(true);
  });
  it('briefly hops when a sleeping chicken is clicked, then settles back to sleep', () => {
    const w = atTime(world(), 1080); for (let t = 0; t < 700; t++) w.advance();
    const id = w.flock!.shelterId;
    expect(w.clickChicken(id, 1)).toBe(true);
    for (let t = 0; t < 10; t++) w.advance();
    expect(w.snapshot().chickens![0].pose).toBe('hop');
    for (let t = 0; t < 10; t++) w.advance();
    expect(w.snapshot().chickens![0].pose).toBe('sleep');
  });
  it('produces at dawn, caps storage indefinitely, and grants each basket exactly once', () => {
    let w = atTime(world(), 359); w.advance(); expect(w.snapshot().eggBaskets).toEqual([]);
    w = atTime(w, 360); w.advance(); expect(w.snapshot().eggBaskets).toHaveLength(1);
    for (let day = 2; day < 40; day++) { w = atTime(w, 360, day); w.advance(); }
    expect(w.snapshot().eggBaskets).toHaveLength(3);
    const b = w.snapshot().eggBaskets![0], food = w.resources.food;
    expect(w.collectEggs(b.shelterId, b.id)).toBe(3); expect(w.resources.food).toBe(food + 3);
    expect(() => w.collectEggs(b.shelterId, b.id)).toThrow('already collected'); expect(w.resources.food).toBe(food + 3);
    w.advance(); expect(w.snapshot().eggBaskets).toHaveLength(2);
    w = atTime(w, 360, 40); w.advance(); expect(w.snapshot().eggBaskets).toHaveLength(3);
    expect(w.flock!.chickens).toHaveLength(3);
  });
  it('hops on clicks with a cooldown, and reacts to passing walkers', () => {
    const w = atTime(world(), 480), id = w.flock!.shelterId;
    expect(w.clickChicken(id, 1)).toBe(true); expect(w.clickChicken(id, 1)).toBe(false);
    expect(w.snapshot().chickens![0].pose).toBe('hop');
    for (let t = 0; t < 100; t++) w.advance(); expect(w.clickChicken(id, 1)).toBe(true);
    const f = w.flock!, c = f.chickens[1]; c.reactionCooldown = 0;
    const ground = new ChickenGround(w.terrain, JSON.parse(w.exportState()).occupancy);
    tickFlock(f, ground, 480, 200, [{ x: c.x, y: c.y }]);
    expect(['tilt', 'scurry']).toContain(c.activity); expect(c.reactionCooldown).toBeGreaterThan(0);
  });
  it('allows construction under a chicken and relocates it to free ground', () => {
    const w = world(), c = w.snapshot().chickens![0];
    w.placeBuilding('hut', Math.floor(c.x / 32), Math.floor(c.y / 32), 0);
    const ground = new ChickenGround(w.terrain, JSON.parse(w.exportState()).occupancy);
    for (const c of w.snapshot().chickens ?? []) expect(ground.free(...ground.tile(c))).toBe(true);
  });
  it('preserves names, positions, stored baskets and seeded continuation through save/load', () => {
    const w = atTime(world(), 480); for (let t = 0; t < 173; t++) w.advance();
    const saved = w.exportState(), restored = DemoWorld.importState(saved);
    expect(restored.flock).toEqual(w.flock); expect(restored.exportState()).toBe(saved);
    for (let t = 0; t < 600; t++) { w.advance(); restored.advance(); }
    expect(restored.flock).toEqual(w.flock); expect(restored.exportState()).toBe(w.exportState());
  });
  it('rejects corrupt animal positions or duplicate baskets', () => {
    const saved = JSON.parse(world().exportState()); saved.flock.chickens[0].x = -1;
    expect(() => DemoWorld.importState(JSON.stringify(saved))).toThrow('invalid chicken');
    saved.flock.chickens[0].x = 300; saved.flock.baskets = [1, 1]; saved.flock.nextBasket = 2;
    expect(() => DemoWorld.importState(JSON.stringify(saved))).toThrow('invalid baskets');
  });
  it('hover identifies a chicken by name/activity and each individual basket', () => {
    const w = atTime(world(), 480); w.advance(); const snapshot = w.snapshot();
    const c = snapshot.chickens![0];
    expect(hoverTargetAt({ snapshot, catalog: DEMO_CATALOG, worldX: c.x, worldY: c.y - 15, tileSize: 32, zoom: 1 })?.title).toBe(c.name);
    const b = snapshot.eggBaskets![0];
    expect(hoverTargetAt({ snapshot, catalog: DEMO_CATALOG, worldX: b.x, worldY: b.y - 5, tileSize: 32, zoom: 1 })).toMatchObject({ kind: 'eggBasket', id: b.id, shelterId: b.shelterId });
  });
});
