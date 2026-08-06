import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Atlas, AtlasManifest } from './atlas';
import { buildDrawListWithStats, type Facing } from './scene';
import { TileSpatialIndex, visibleTileBounds } from './spatial';
import { terrainProps } from './tilemap';
import { generateDemoTerrain } from '../state/demoTerrain';
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

describe('buildDrawList viewport cull', () => {
  const atlas = fakeAtlas();
  const lastFacing = new Map<number, Facing>();

  it('omits props and crops outside viewTiles', () => {
    const { list, propsDrawn } = buildDrawListWithStats({
      snapshot: snapshot({
        crops: [
          { id: 1, x: 2, y: 2, kind: 0, stage: 0 },
          { id: 2, x: 50, y: 50, kind: 0, stage: 0 },
        ],
        buildings: [{ id: 1, kind: 0, x: 2, y: 2, rot: 0, state: 2, progress: 100 }],
        villagers: [
          { id: 1, x: 2 * 32 + 16, y: 2 * 32 + 16, state: 0 },
          { id: 2, x: 80 * 32, y: 80 * 32, state: 0 },
        ],
      }),
      catalog: { buildings, crops },
      props: [
        { x: 3, y: 3, key: 'prop.cypress' },
        { x: 60, y: 60, key: 'prop.peak' },
      ],
      viewTiles: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      tileSize: 32,
      tick: 0,
      reduceMotion: true,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });

    expect(list.find((e) => e.id === 'c:1')).toBeTruthy();
    expect(list.find((e) => e.id === 'c:2')).toBeUndefined();
    expect(list.find((e) => e.id === 'p:3,3')).toBeTruthy();
    expect(list.find((e) => e.id === 'p:60,60')).toBeUndefined();
    expect(list.find((e) => e.id === 'v:1')).toBeTruthy();
    expect(list.find((e) => e.id === 'v:2')).toBeUndefined();
    expect(list.find((e) => e.id === 'b:1')).toBeTruthy();
    expect(propsDrawn).toBe(1);
  });
});

describe('perf baseline (demo terrain)', () => {
  it('viewport + spatial index draws far fewer props than the full map', () => {
    const terrain = generateDemoTerrain();
    const props = terrainProps(terrain);
    const index = new TileSpatialIndex<typeof props[number]>();
    index.build(props);

    // Typical zoomed-in play: ~40×25 tiles of world visible.
    const view = visibleTileBounds(
      { x: 40 * 32, y: 40 * 32, w: 40 * 32, h: 25 * 32 },
      terrain.tileSize,
      2,
    );
    const atlas = fakeAtlas();
    const lastFacing = new Map<number, Facing>();
    const full = buildDrawListWithStats({
      snapshot: snapshot(),
      catalog: { buildings, crops },
      props,
      tileSize: terrain.tileSize,
      tick: 0,
      reduceMotion: true,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });
    const culled = buildDrawListWithStats({
      snapshot: snapshot(),
      catalog: { buildings, crops },
      props,
      propsIndex: index,
      viewTiles: view,
      tileSize: terrain.tileSize,
      tick: 0,
      reduceMotion: true,
      selectedBuildingId: null,
      selectedVillagerId: null,
      lastFacing,
      atlas,
    });

    expect(props.length).toBeGreaterThan(800);
    expect(full.propsDrawn).toBe(props.length);
    // Culled path should keep under half of the full-map prop work for a ~40×25 view.
    expect(culled.propsDrawn).toBeLessThan(props.length / 2);
    expect(culled.propsDrawn).toBeGreaterThan(0);
    expect(culled.list.length).toBe(culled.propsDrawn);
    // Spatial index query must match a naive filter of the same bounds.
    const naive = props.filter(
      (p) =>
        p.x >= view.minX && p.x <= view.maxX && p.y >= view.minY && p.y <= view.maxY,
    ).length;
    expect(culled.propsDrawn).toBe(naive);
  });
});
