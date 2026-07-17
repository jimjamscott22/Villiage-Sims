import { describe, expect, it } from 'vitest';
import { SnapshotBuffer } from './snapshot';

const tick = (number: number, x: number) => ({
  tick: number,
  villagers: [{ id: 1, x, y: 20 }],
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
});
