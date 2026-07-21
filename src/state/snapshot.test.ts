import { describe, expect, it } from 'vitest';
import { SnapshotBuffer } from './snapshot';
import type { ResourceTotals, TickSnapshot } from './types';

const resources: ResourceTotals = { wood: 120, stone: 40, grain: 0, food: 0, gold: 0 };

const tick = (number: number, x: number): TickSnapshot => ({
  tick: number,
  clock: { minute: 0, day: 1, season: 0, year: 1, speed: 1 },
  villagers: [{ id: 1, x, y: 20 }],
  buildings: [{ id: 9, kind: 0, x: 1, y: 2, rot: 0, state: 2, progress: 100 }],
  crops: [],
  resources,
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
  });
});
