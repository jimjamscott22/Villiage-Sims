import { describe, expect, it } from 'vitest';
import { DemoWorld, DEMO_CATALOG } from './demoWorld';
import type { VisitorView } from './types';

function world() { return new DemoWorld({ width: 16, height: 16, tileSize: 32, tiles: Array(256).fill(3) }); }
function tick(w: DemoWorld, count: number) { for (let i = 0; i < count; i++) w.advance(); }
function visitor(w: DemoWorld): VisitorView { return w.snapshot().visitor!; }
function toMusician(w: DemoWorld) { tick(w, 1000); w.respondToVisitor(visitor(w).visitId, 'decline'); tick(w, 6000); }
function toGrower(w: DemoWorld) { toMusician(w); w.respondToVisitor(visitor(w).visitId, 'decline'); tick(w, 6000); }
function hut(w: DemoWorld, x: number, y: number) {
  w.resources.wood += 20;
  const id = w.placeBuilding('hut', x, y, 0).id;
  const b = w.buildings.find(b => b.id === id)!; b.complete = true;
  b.progressTicks = DEMO_CATALOG.buildings[b.kindIndex].buildTicks;
  return id;
}

describe('visitor opportunities in the browser simulation', () => {
  it('trades exactly once and rechecks available food without partial spending', () => {
    const w = world(); tick(w, 1000);
    const id = visitor(w).visitId;
    w.resources.food = 11;
    expect(visitor(w).canAccept).toBe(false);
    expect(() => w.respondToVisitor(id, 'accept')).toThrow('food');
    expect(w.resources.food).toBe(11);
    w.resources.food = 20;
    const grain = w.resources.grain;
    w.respondToVisitor(id, 'accept');
    expect(w.resources.food).toBe(8); expect(w.resources.grain).toBe(grain + 8);
    expect(w.snapshot().visitor).toBeNull();
    expect(() => w.respondToVisitor(id, 'accept')).toThrow('no longer');
    expect(w.resources.food).toBe(8);
    expect(w.getChronicle().some(e => e.body.kind === 'visitorEvent' && e.body.outcome === 'accepted')).toBe(true);
  });
  it('musician raises Social for current villagers and caps it at full', () => {
    const w = world(); toMusician(w);
    const state = JSON.parse(w.exportState());
    state.villagers[0].needs.social = 0.3; state.villagers[1].needs.social = 0.95;
    const loaded = DemoWorld.importState(JSON.stringify(state)); loaded.resources.food = 6;
    loaded.respondToVisitor(visitor(loaded).visitId, 'accept');
    expect(loaded.getVillagerRoster()[0].social).toBeCloseTo(0.5);
    expect(loaded.getVillagerRoster()[1].social).toBe(1);
    expect(loaded.resources.food).toBe(0);
  });
  it('grower needs an actual vacant completed reachable home, then settles once', () => {
    const w = world(); toGrower(w);
    expect(visitor(w).canAccept).toBe(false);
    expect(() => w.respondToVisitor(visitor(w).visitId, 'accept')).toThrow('housing');
    hut(w, 2, 2); hut(w, 4, 2); const last = hut(w, 6, 2);
    tick(w, 1);
    expect(visitor(w).canAccept).toBe(true);
    const before = w.getVillagerRoster().length;
    w.respondToVisitor(visitor(w).visitId, 'accept');
    const mira = w.getVillagerRoster().find(v => v.name === 'Mira')!;
    expect(mira.traits).toEqual(['green_thumb']); expect(mira.home).toBe(last);
    expect(w.getVillagerRoster()).toHaveLength(before + 1);
    tick(w, 6000); expect(visitor(w).visitor).toBe('merchant');
  });
  it('rechecks a demolished home and never charges or spawns on failed recruitment', () => {
    const w = world(); toGrower(w);
    hut(w, 2, 2); hut(w, 4, 2); const last = hut(w, 6, 2); tick(w, 1);
    const id = visitor(w).visitId; expect(visitor(w).canAccept).toBe(true);
    w.demolish(last);
    expect(() => w.respondToVisitor(id, 'accept')).toThrow('housing');
    expect(w.getVillagerRoster()).toHaveLength(5);
  });
  it('rejects incomplete, disconnected and fully occupied arrival ground', () => {
    const w = world(); toGrower(w);
    hut(w, 2, 2); hut(w, 4, 2); const home = hut(w, 6, 2); tick(w, 1);
    const state = JSON.parse(w.exportState());
    state.encounters = []; state.behavior = {};
    state.villagers.forEach((v: { x: number; y: number }, i: number) => { v.x = (8 + i) * 32 + 16; v.y = 8 * 32 + 16; });
    const last = state.buildings.find((b: { id: number }) => b.id === home);
    last.complete = false; last.progressTicks = 0;
    expect(visitor(DemoWorld.importState(JSON.stringify(state))).canAccept).toBe(false);
    last.complete = true;
    for (let y = 0; y < 16; y++) state.terrain.tiles[y * 16 + 7] = 0;
    expect(visitor(DemoWorld.importState(JSON.stringify(state))).canAccept).toBe(false);
    state.terrain.tiles.fill(0);
    state.villagers.forEach((v: { x: number; y: number }, i: number) => {
      state.terrain.tiles[2 * 16 + 7 + i] = 3; v.x = (7 + i) * 32 + 16; v.y = 2 * 32 + 16;
    });
    // Social state can include journeys from before this fixture changed the ground.
    state.encounters = []; state.behavior = {};
    const loaded = DemoWorld.importState(JSON.stringify(state));
    const before = loaded.exportState();
    expect(visitor(loaded).canAccept).toBe(false);
    expect(() => loaded.respondToVisitor(visitor(loaded).visitId, 'accept')).toThrow('arrival tile');
    expect(loaded.exportState()).toBe(before);
  });
  it('uses stored food atomically and rejects malformed saved visits', () => {
    const w = world(); tick(w, 1000);
    const granary = w.placeBuilding('granary', 2, 2, 0).id;
    w.resources.food = 2;
    w.buildings.find(b => b.id === granary)!.inventory.food = 10;
    w.respondToVisitor(visitor(w).visitId, 'accept');
    expect(w.snapshot().resources.food).toBe(0);
    const state = JSON.parse(w.exportState()); state.visits.remainingTicks = 0;
    expect(() => DemoWorld.importState(JSON.stringify(state))).toThrow('visitor');
  });
  it('freezes when paused, persists chronology and countdown, and migrates v4 fresh', () => {
    const w = world(); tick(w, 1000); tick(w, 23); w.setSpeed(0);
    const before = w.exportState(); tick(w, 100); expect(w.exportState()).toBe(before);
    const loaded = DemoWorld.importState(before);
    expect(loaded.exportState()).toBe(before);
    expect(loaded.getChronicle()).toEqual(w.getChronicle());
    loaded.setSpeed(1); w.setSpeed(1); tick(w, 10); tick(loaded, 10);
    expect(loaded.exportState()).toBe(w.exportState());
    const legacy = JSON.parse(before); legacy.version = 4; delete legacy.visits;
    expect(DemoWorld.importState(JSON.stringify(legacy)).snapshot().visitor).toBeNull();
  });
  it.each([1, 16, 999])('does not count fractional minutes twice when jumping at tick %i', (ticks) => {
    const direct = world(); direct.advanceClock(1, null);
    const partial = world(); tick(partial, ticks); partial.advanceClock(1, null);
    expect(JSON.parse(partial.exportState()).visits).toEqual(JSON.parse(direct.exportState()).visits);
  });
  it('stamps a visitor departure at the midnight boundary with the new date', () => {
    const w = world(); tick(w, 1000);
    const state = JSON.parse(w.exportState());
    state.clock.minuteAccum = 1439.94; state.clock.minute = 1439;
    state.visits.remainingTicks = 1;
    const loaded = DemoWorld.importState(JSON.stringify(state)); loaded.advanceClock(1, null);
    const departure = loaded.getChronicle().find(e => e.body.kind === 'visitorEvent' && e.body.outcome === 'expired')!;
    expect(departure.day).toBe(2);
  });
  it('processes timed visits chronologically through a debug day jump', () => {
    const w = world(); w.advanceClock(1, null);
    expect(w.snapshot().visitor).toBeNull();
    const events = w.getChronicle().filter(e => e.body.kind === 'visitorEvent');
    expect(events.map(e => e.body.kind === 'visitorEvent' && e.body.outcome)).toEqual(['arrived', 'expired', 'arrived', 'expired', 'arrived', 'expired']);
    expect(events.every(e => e.day === 1)).toBe(true);
  });
});
