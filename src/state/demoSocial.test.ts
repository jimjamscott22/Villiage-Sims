import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG, DemoWorld, type DemoVillager } from './demoWorld';
import type { DemoSocial } from './demoSocial';

function openWorld(): DemoWorld {
  const initial = new DemoWorld({ width: 32, height: 32, tileSize: 32, tiles: new Array(32 * 32).fill(3) });
  const state = JSON.parse(initial.exportState());
  state.villagers = state.villagers.slice(0, 2);
  state.villagers.forEach((v: DemoVillager, i: number) => { v.x = (2 + i * 3) * 32 + 16; v.y = 80; v.needs.social = 0.4; });
  state.resources.wood = 1000; state.resources.stone = 1000;
  return DemoWorld.importState(JSON.stringify(state));
}
function internals(w: DemoWorld): { social: DemoSocial; villagers: DemoVillager[] } {
  return w as unknown as { social: DemoSocial; villagers: DemoVillager[] };
}
function complete(w: DemoWorld, kind: string, x: number, y: number): number {
  const placed = w.placeBuilding(kind, x, y, 0);
  const building = w.buildings.find(b => b.id === placed.id)!;
  building.complete = true;
  building.progressTicks = DEMO_CATALOG.buildings[building.kindIndex].buildTicks;
  (w as unknown as { advertiseJobsFor(id: number): void }).advertiseJobsFor(placed.id);
  internals(w).social.leisure.refresh();
  return placed.id;
}
function reachChat(w: DemoWorld): void {
  const { social, villagers } = internals(w);
  expect(social.begin(villagers[0])).toBe(true);
  for (let t = 0; t < 200 && !social.encounters[0]?.talking; t++) w.advance();
  expect(social.encounters[0]?.talking).toBe(true);
}

describe('paired conversations', () => {
  it('approaches without a reward, stops together, restores both meters, and cools down', () => {
    const w = openWorld(), { social, villagers } = internals(w);
    expect(social.begin(villagers[0])).toBe(true);
    w.advance();
    expect(villagers.every(v => v.needs.social < 0.4)).toBe(true);
    expect(w.getVillagerDetail(villagers[1].id).stateLabel).toBe('Waiting for Ash');
    for (let t = 0; t < 199 && !social.encounters[0]?.talking; t++) w.advance();
    const positions = villagers.map(v => [v.x, v.y]);
    const before = villagers.map(v => v.needs.social);
    expect(w.snapshot().villagers.every(v => v.activity === 'talking')).toBe(true);
    for (let t = 0; t < 120; t++) w.advance();
    expect(social.encounters).toHaveLength(0);
    villagers.forEach((v, i) => {
      expect([v.x, v.y]).toEqual(positions[i]);
      expect(v.needs.social - before[i]).toBeCloseTo(0.30 - 120 * 0.00003, 5);
      expect(social.leisure.state(v.id).cooldown).toBe(400);
      expect(v.state).toBe('idle');
    });
  });
  it('reserves both participants and cancels both when the player gives an order', () => {
    const w = openWorld(); reachChat(w);
    const { social, villagers } = internals(w);
    expect(social.begin(villagers[1])).toBe(false);
    w.moveVillagerTo(10, 2, villagers[0].id);
    expect(social.encounters).toHaveLength(0);
    expect(villagers[0].purpose).toBe('player');
    expect(villagers[1].state).toBe('idle');
    expect(social.eligible(villagers[1])).toBe(false);
  });
  it.each(['energy', 'hunger'] as const)('cancels when %s becomes urgent without a completion bonus', need => {
    const w = openWorld(); reachChat(w);
    const { social, villagers } = internals(w), before = villagers[1].needs.social;
    villagers[0].needs[need] = 0.25;
    w.advance();
    expect(social.encounters).toHaveLength(0);
    expect(villagers[1].needs.social).toBeLessThan(before);
  });
  it('does not recruit a busy partner and times out an approach that never arrives', () => {
    const w = openWorld(), { social, villagers } = internals(w);
    villagers[1].state = 'sleeping';
    expect(social.begin(villagers[0])).toBe(false);
    villagers[1].state = 'idle'; expect(social.begin(villagers[0])).toBe(true);
    for (let t = 0; t < 200; t++) social.tick();
    expect(social.encounters).toHaveLength(0);
    expect(social.leisure.state(villagers[0].id).cooldown).toBe(100);
    expect(villagers[0].needs.social).toBe(0.4);
  });
  it.each([0, 50, 180])('continues a save made after %i ticks identically', ticks => {
    const w = openWorld(), { social, villagers } = internals(w);
    expect(social.begin(villagers[0])).toBe(true);
    for (let t = 0; t < ticks; t++) w.advance();
    const saved = w.exportState(), loaded = DemoWorld.importState(saved);
    expect(loaded.exportState()).toBe(saved);
    for (let t = 0; t < 250; t++) { w.advance(); loaded.advance(); }
    expect(loaded.exportState()).toBe(w.exportState());
  });
  it('migrates old browser saves without resetting Social and rejects duplicate participants', () => {
    const w = openWorld(), state = JSON.parse(w.exportState());
    state.version = 1; delete state.encounters; delete state.behavior;
    state.villagers[0].state = 'socializing'; state.villagers[0].currentAction = 'socialize';
    const loaded = DemoWorld.importState(JSON.stringify(state));
    expect(loaded.getVillagerDetail(state.villagers[0].id)).toMatchObject({ social: 0.4, state: 0 });
    reachChat(w);
    const bad = JSON.parse(w.exportState()); bad.encounters[0].b = bad.encounters[0].a;
    expect(() => DemoWorld.importState(JSON.stringify(bad))).toThrow('invalid social encounter');
  });
});

describe('purposeful leisure', () => {
  it('counts completed reachable huts, caps density, and ignores a disconnected cluster', () => {
    const w = openWorld(), { social } = internals(w);
    complete(w, 'hut', 10, 10);
    expect(social.leisure.density([9, 10])).toBe(1);
    const incomplete = w.placeBuilding('hut', 14, 10, 0);
    social.leisure.refresh(); expect(social.leisure.density([9, 10])).toBe(1);
    w.demolish(incomplete.id);
    for (const [x, y] of [[14, 10], [10, 14], [14, 14], [6, 10], [6, 14]]) complete(w, 'hut', x, y);
    expect(social.leisure.density([12, 12])).toBe(5);
    const state = JSON.parse(w.exportState());
    for (let x = 0; x < 32; x++) state.terrain.tiles[8 * 32 + x] = 0;
    const separated = internals(DemoWorld.importState(JSON.stringify(state))).social;
    separated.leisure.refresh(); expect(separated.leisure.density([10, 7])).toBe(0);
  });
  it('reserves different destinations, commits while travelling, and invalidates on demolition', () => {
    const w = openWorld(), { social, villagers } = internals(w);
    const hut = complete(w, 'hut', 8, 8);
    for (const v of villagers) { v.needs.social = 1; social.leisure.begin(v, t => social.reserved(t, v.id)); }
    const first = social.leisure.state(villagers[0].id).destination;
    expect(first).not.toBeNull(); expect(first).not.toEqual(social.leisure.state(villagers[1].id).destination);
    w.advance(); expect(social.leisure.state(villagers[0].id).destination).toEqual(first);
    w.demolish(hut); social.prepare();
    expect(Object.values(social.leisure.behavior).every(b => b.destination == null)).toBe(true);
  });
  it('pauses on arrival and then chooses a different destination', () => {
    const w = openWorld(), { social, villagers } = internals(w);
    complete(w, 'hut', 7, 7); villagers.splice(1);
    const v = villagers[0]; v.needs.social = 1;
    social.leisure.begin(v, t => social.reserved(t, v.id));
    for (let t = 0; t < 200 && social.leisure.state(v.id).pause === 0; t++) w.advance();
    expect(social.leisure.state(v.id).pause).toBe(80);
    const old = social.leisure.state(v.id).destination, pos = [v.x, v.y];
    for (let t = 0; t < 79; t++) { w.advance(); expect([v.x, v.y]).toEqual(pos); }
    w.advance(); expect(social.leisure.state(v.id).destination).not.toEqual(old);
  });
  it('yields to an actionable job without recruiting a worker', () => {
    const w = openWorld(), { social, villagers } = internals(w);
    const v = villagers[0]; v.needs.social = 1;
    social.leisure.begin(v, t => social.reserved(t, v.id));
    w.resources.grain = 20;
    complete(w, 'farm', 9, 9);
    w.advance();
    expect(v.currentJob).not.toBeNull(); expect(social.eligible(v)).toBe(false);
    expect(social.leisure.state(v.id).destination).toBeNull();
    for (let t = 0; t < 300; t++) w.advance();
    expect(w.crops.length).toBeGreaterThan(0);
  });
  it('pauses simulation timers at speed zero', () => {
    const w = openWorld(); reachChat(w);
    w.setSpeed(0); const state = w.exportState();
    for (let t = 0; t < 50; t++) w.advance();
    expect(w.exportState()).toBe(state);
  });
});
