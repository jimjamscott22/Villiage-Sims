import { describe, expect, it } from 'vitest';
import type { Catalog, TickSnapshot } from '../state/types';
import { hoverTargetAt } from './hover';

const catalog: Catalog = {
  buildings: [
    {
      id: 'farm',
      name: 'Farm',
      footprint: [3, 2],
      cost: {},
      buildTicks: 100,
      category: 'production',
      validTerrain: ['grass'],
    },
  ],
  crops: [
    {
      id: 'wheat',
      name: 'Wheat',
      stages: 4,
      ticksPerStage: 100,
      seasons: ['Spring'],
      waterRequired: true,
    },
  ],
};

function snapshot(partial: Partial<TickSnapshot> = {}): TickSnapshot {
  return {
    tick: 0,
    villagers: [],
    buildings: [],
    crops: [],
    resources: { wood: 0, stone: 0, grain: 0, flour: 0, food: 0, gold: 0 },
    housingCapacity: 5,
    clock: { minute: 0, day: 1, season: 0, year: 1, speed: 1, weather: 0 },
    chronicleSeq: 0,
    unlocked: [],
    ...partial,
  };
}

describe('hoverTargetAt', () => {
  it('prefers the closest villager over entities beneath it', () => {
    const target = hoverTargetAt({
      snapshot: snapshot({
        villagers: [
          { id: 1, x: 82, y: 82, state: 1 },
          { id: 2, x: 79, y: 80, state: 2 },
        ],
        buildings: [{ id: 3, kind: 0, x: 2, y: 2, rot: 0, state: 2, progress: 100 }],
      }),
      catalog,
      worldX: 80,
      worldY: 80,
      tileSize: 32,
      zoom: 1,
    });

    expect(target).toEqual({
      kind: 'villager',
      id: 2,
      title: 'Villager #2',
      detail: 'Working',
    });
  });

  it('shows crop growth above its farm footprint', () => {
    const target = hoverTargetAt({
      snapshot: snapshot({
        buildings: [{ id: 3, kind: 0, x: 2, y: 2, rot: 0, state: 2, progress: 100 }],
        crops: [{ id: 4, kind: 0, x: 3, y: 2, stage: 1 }],
      }),
      catalog,
      worldX: 3 * 32 + 16,
      worldY: 2 * 32 + 16,
      tileSize: 32,
      zoom: 1,
    });

    expect(target).toMatchObject({
      kind: 'crop',
      title: 'Wheat',
      detail: 'Growth stage 2 of 4',
    });
  });

  it('accounts for rotated building footprints and construction progress', () => {
    const target = hoverTargetAt({
      snapshot: snapshot({
        buildings: [{ id: 5, kind: 0, x: 4, y: 6, rot: 1, state: 1, progress: 48 }],
      }),
      catalog,
      worldX: 5 * 32 + 16,
      worldY: 8 * 32 + 16,
      tileSize: 32,
      zoom: 1,
    });

    expect(target).toEqual({
      kind: 'building',
      id: 5,
      title: 'Farm',
      detail: 'Building · 48%',
    });
  });

  it('marks the final crop stage ready for harvest', () => {
    const target = hoverTargetAt({
      snapshot: snapshot({
        crops: [{ id: 6, kind: 0, x: 1, y: 1, stage: 3 }],
      }),
      catalog,
      worldX: 48,
      worldY: 48,
      tileSize: 32,
      zoom: 1,
    });

    expect(target?.detail).toBe('Ready to harvest');
  });

  it('returns null over empty ground', () => {
    expect(hoverTargetAt({
      snapshot: snapshot(),
      catalog,
      worldX: 10,
      worldY: 10,
      tileSize: 32,
      zoom: 1,
    })).toBeNull();
  });
});
