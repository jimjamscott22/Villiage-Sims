import { describe, expect, it } from 'vitest';
import { SnapshotBuffer } from './snapshot';
import type { ResourceTotals, TickSnapshot } from './types';

const resources: ResourceTotals = { wood: 120, stone: 40, grain: 0, flour: 0, food: 0, gold: 0 };

const tick = (number: number, x: number): TickSnapshot => ({
  tick: number,
  villagers: [{ id: 1, x, y: 20 }],
  buildings: [{ id: 9, kind: 0, x: 1, y: 2, rot: 0, state: 2, progress: 100 }],
  crops: [],
  resources,
  housingCapacity: 5,
  clock: { minute: 0, day: 1, season: 0, year: 1, speed: 1, weather: 0 },
  chronicleSeq: 0,
  unlocked: [],
});

describe('SnapshotBuffer', () => {
  it('renders the current position when there is no previous snapshot', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(tick(1, 10), 1000);

    expect(buffer.interpolate(1025, 50)?.villagers[0].x).toBe(10);
  });

  it('interpolates matching villagers halfway through a tick', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(tick(1, 10), 950);
    buffer.push(tick(2, 20), 1000);

    expect(buffer.interpolate(1025, 50)?.villagers[0].x).toBe(15);
  });

  it('clamps interpolation after a full tick interval', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(tick(1, 10), 950);
    buffer.push(tick(2, 20), 1000);

    expect(buffer.interpolate(1100, 50)?.villagers[0].x).toBe(20);
  });

  it('passes buildings and resources through without interpolation', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(tick(1, 10), 1000);
    const rendered = buffer.interpolate(1025, 50);
    expect(rendered?.buildings).toEqual(tick(1, 10).buildings);
    expect(rendered?.resources.wood).toBe(120);
    expect(rendered?.clock.day).toBe(1);
  });

  it('emits dx/dy from the snapshot delta', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(tick(1, 10), 950);
    buffer.push(tick(2, 20), 1000);
    const villager = buffer.interpolate(1025, 50)?.villagers[0];
    expect(villager?.dx).toBe(10);
    expect(villager?.dy).toBe(0);
  });

  it('emits zero deltas when the villager is stationary', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(tick(1, 10), 950);
    buffer.push(tick(2, 10), 1000);
    const villager = buffer.interpolate(1025, 50)?.villagers[0];
    expect(villager?.dx).toBe(0);
    expect(villager?.dy).toBe(0);
  });
});

it('interpolates chickens and preserves baskets and shelter identity', () => {
  const buffer = new SnapshotBuffer();
  const chicken = { id: 1, shelterId: 2, name: 'Pip', tendency: 'curious' as const, x: 20, y: 40,
    pose: 'walk' as const, activity: 'exploring', soundSeq: 0, facingLeft: false };
  buffer.push({ ...tick(1, 0), chickens: [chicken] }, 950);
  const basket = { id: 1, shelterId: 2, x: 60, y: 70 };
  buffer.push({ ...tick(2, 0), chickenShelterId: 2, chickens: [{ ...chicken, x: 30 }], eggBaskets: [basket] }, 1000);
  const snapshot = buffer.interpolate(1025, 50);
  expect(snapshot?.chickens?.[0].x).toBe(25);
  expect(snapshot?.eggBaskets).toEqual([basket]);
  expect(snapshot?.chickenShelterId).toBe(2);
  // A replacement shelter must never interpolate from its predecessor's flock.
  buffer.push({ ...tick(3, 0), chickens: [{ ...chicken, shelterId: 3, x: 50 }] }, 1050);
  expect(buffer.interpolate(1075, 50)?.chickens?.[0].x).toBe(50);
});
