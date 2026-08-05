import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Atlas, AtlasManifest } from './atlas';
import {
  atlasHasEntities,
  buildDrawList,
  dyeIndex,
  facingFromDelta,
  type Facing,
} from './scene';
import type { BuildingDef, CropDef, TickSnapshot } from '../state/types';

const manifest = JSON.parse(readFileSync('public/art/atlas.json', 'utf8')) as AtlasManifest;

function fakeAtlas(): Atlas {
  return { manifest, images: {} };
}

const buildings: BuildingDef[] = [
  {
    id: 'hut',
    name: 'Hut',
    footprint: [1, 1],
    cost: {},
    buildTicks: 1,
    category: 'housing',
    validTerrain: ['grass'],
  },
  {
    id: 'farm',
    name: 'Farm',
    footprint: [3, 3],
    cost: {},
    buildTicks: 1,
    category: 'production',
    validTerrain: ['grass'],
  },
];

const crops: CropDef[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    stages: 4,
    ticksPerStage: 1,
    seasons: ['spring'],
    waterRequired: false,
  },
];

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

describe('facingFromDelta', () => {
  it('picks the dominant axis', () => {
    expect(facingFromDelta(2, 1)).toBe('e');
    expect(facingFromDelta(-3, 1)).toBe('w');
    expect(facingFromDelta(1, 4)).toBe('s');
    expect(facingFromDelta(1, -4)).toBe('n');
  });

  it('returns null when stationary', () => {
    expect(facingFromDelta(0, 0)).toBeNull();
  });
});

describe('dyeIndex', () => {
  it('wraps across six dyes', () => {
    expect(dyeIndex(0)).toBe(0);
    expect(dyeIndex(5)).toBe(5);
    expect(dyeIndex(6)).toBe(0);
    expect(dyeIndex(-1)).toBe(5);
  });
});

describe('atlasHasEntities', () => {
  it('detects the committed entities sheet', () => {
    expect(atlasHasEntities(fakeAtlas())).toBe(true);
  });
});

describe('buildDrawList', () => {
  const atlas = fakeAtlas();
  const lastFacing = new Map<number, Facing>();

  it('sorts a farm field before its crops', () => {
    const list = buildDrawList({
      snapshot: snapshot({
        buildings: [{ id: 1, kind: 1, x: 2, y: 2, rot: 0, state: 2, progress: 100 }],
        crops: [{ id: 9, x: 3, y: 4, kind: 0, stage: 2 }],
      }),
      catalog: { buildings, crops },
      props: [],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    const field = list.findIndex((e) => e.id === 'field:1');
    const crop = list.findIndex((e) => e.id === 'c:9');
    expect(field).toBeGreaterThanOrEqual(0);
    expect(crop).toBeGreaterThanOrEqual(0);
    expect(list[field].rank).toBe(0);
    expect(list[crop].rank).toBe(1);
    expect(field).toBeLessThan(crop);
  });

  it('sorts a villager south of a building after it', () => {
    const list = buildDrawList({
      snapshot: snapshot({
        buildings: [{ id: 1, kind: 0, x: 5, y: 5, rot: 0, state: 2, progress: 100 }],
        villagers: [{ id: 2, x: 5 * 32 + 16, y: 8 * 32, state: 0, dx: 0, dy: 0 }],
      }),
      catalog: { buildings, crops },
      props: [],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    const building = list.find((e) => e.id === 'b:1')!;
    const villager = list.find((e) => e.id === 'v:2')!;
    expect(villager.baseY).toBeGreaterThan(building.baseY);
    expect(list.indexOf(building)).toBeLessThan(list.indexOf(villager));
  });

  it('is stable for equal baseY via id tie-break', () => {
    const list = buildDrawList({
      snapshot: snapshot({
        crops: [
          { id: 2, x: 1, y: 1, kind: 0, stage: 0 },
          { id: 1, x: 1, y: 1, kind: 0, stage: 0 },
        ],
      }),
      catalog: { buildings, crops },
      props: [],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    const ids = list.filter((e) => e.id.startsWith('c:')).map((e) => e.id);
    expect(ids).toEqual(['c:1', 'c:2']);
  });

  it('holds last facing when delta is zero', () => {
    const facing = new Map<number, Facing>();
    buildDrawList({
      snapshot: snapshot({
        villagers: [{ id: 7, x: 10, y: 10, state: 1, dx: 3, dy: 0 }],
      }),
      catalog: { buildings, crops },
      props: [],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing: facing,
      atlas,
    });
    expect(facing.get(7)).toBe('e');

    const list = buildDrawList({
      snapshot: snapshot({
        villagers: [{ id: 7, x: 10, y: 10, state: 0, dx: 0, dy: 0 }],
      }),
      catalog: { buildings, crops },
      props: [],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing: facing,
      atlas,
    });
    expect(facing.get(7)).toBe('e');
    expect(list.find((e) => e.id === 'v:7')?.key).toBe('villager.e.idle.1');
  });

  it('draws a scaffold while a building is under construction', () => {
    const list = buildDrawList({
      snapshot: snapshot({
        buildings: [{ id: 3, kind: 0, x: 1, y: 1, rot: 0, state: 1, progress: 40 }],
      }),
      catalog: { buildings, crops },
      props: [],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    expect(list.find((e) => e.id === 'b:3')?.key).toBe('scaffold.1');
  });

  it('includes terrain props', () => {
    const list = buildDrawList({
      snapshot: snapshot(),
      catalog: { buildings, crops },
      props: [{ x: 4, y: 4, key: 'prop.cypress' }],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    expect(list.find((e) => e.id === 'p:4,4')?.key).toBe('prop.cypress');
  });

  it('hides decor scatter under a building footprint but keeps it elsewhere', () => {
    const list = buildDrawList({
      // kind 1 is the 3×3 farm at (2,2), so it covers tiles (2,2)…(4,4).
      snapshot: snapshot({
        buildings: [{ id: 5, kind: 1, x: 2, y: 2, rot: 0, state: 2, progress: 100 }],
      }),
      catalog: { buildings, crops },
      props: [
        { x: 3, y: 3, key: 'prop.bush', decor: true },
        { x: 9, y: 9, key: 'prop.bush', decor: true },
        { x: 3, y: 4, key: 'prop.cypress' },
      ],
      tileSize: 32,
      tick: 0,
      reduceMotion: false,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    expect(list.find((e) => e.id === 'p:3,3')).toBeUndefined();
    expect(list.find((e) => e.id === 'p:9,9')?.key).toBe('prop.bush');
    // Non-decor props are terrain-defining and never suppressed.
    expect(list.find((e) => e.id === 'p:3,4')?.key).toBe('prop.cypress');
  });
});
