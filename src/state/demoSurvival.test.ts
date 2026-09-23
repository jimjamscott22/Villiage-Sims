import { describe, expect, it } from 'vitest';
import { DemoWorld } from './demoWorld';

interface Internals {
  villagers: Array<{
    id: number;
    x: number;
    state: string;
    needs: { hunger: number; thirst: number; health: number; happiness: number };
  }>;
}

/** Grass map with a column of shallow water on the right edge. */
function shoreTerrain(width = 16, height = 16) {
  const tiles = new Array(width * height).fill(3);
  for (let y = 0; y < height; y += 1) tiles[y * width + width - 1] = 1;
  return { width, height, tileSize: 32, tiles };
}

function internals(world: DemoWorld): Internals {
  return world as unknown as Internals;
}

function advanceUntil(world: DemoWorld, limit: number, done: () => boolean): void {
  for (let i = 0; i < limit; i += 1) {
    world.advance();
    if (done()) return;
  }
  throw new Error(`condition not reached within ${limit} ticks`);
}

describe('demo thirst and health parity', () => {
  it('reports thirst and health in villager detail, starting full', () => {
    const world = new DemoWorld(shoreTerrain());
    const detail = world.getVillagerDetail(1);
    expect(detail.thirst).toBe(1);
    expect(detail.health).toBe(1);
  });

  it('sends a thirsty villager to the shore to drink', () => {
    const world = new DemoWorld(shoreTerrain());
    internals(world).villagers.splice(1);
    const villager = internals(world).villagers[0];
    villager.needs.thirst = 0.05;
    advanceUntil(world, 400, () => villager.state === 'drinking');
    expect(Math.floor(villager.x / 32)).toBe(14);
    expect(world.getVillagerDetail(villager.id).stateLabel).toBe('Drinking');
    advanceUntil(world, 41, () => villager.needs.thirst === 1);
    expect(villager.state).toBe('idle');
  });

  it('drains health while parched and no water is reachable, without killing', () => {
    const tiles = new Array(16 * 16).fill(3);
    const world = new DemoWorld({ width: 16, height: 16, tileSize: 32, tiles });
    const villager = internals(world).villagers[0];
    villager.needs.thirst = 0;
    for (let i = 0; i < 400; i += 1) world.advance();
    expect(villager.needs.health).toBe(0);
    expect(internals(world).villagers).toContain(villager);
  });

  it('migrates version 2 saves with full thirst and health', () => {
    const state = JSON.parse(new DemoWorld(shoreTerrain()).exportState()) as {
      version: number;
      villagers: Array<{ needs: Record<string, number> }>;
    };
    state.version = 2;
    for (const v of state.villagers) {
      delete v.needs.thirst;
      delete v.needs.health;
    }
    const loaded = DemoWorld.importState(JSON.stringify(state));
    const detail = loaded.getVillagerDetail(1);
    expect(detail.thirst).toBe(1);
    expect(detail.health).toBe(1);
  });
});

describe('demo spawn connectivity', () => {
  it('starts every villager where they can reach each other and water', async () => {
    const { generateDemoTerrain } = await import('./demoTerrain');
    const world = new DemoWorld(generateDemoTerrain());
    const inner = world as unknown as {
      villagers: Array<{ x: number; y: number }>;
      posToTile(x: number, y: number): [number, number];
      reachableFrom(start: [number, number]): Uint8Array;
      nearestWaterAccess(start: [number, number]): [number, number] | null;
      terrain: { width: number };
    };
    const tiles = inner.villagers.map((v) => inner.posToTile(v.x, v.y));
    const home = inner.reachableFrom(tiles[0]);
    for (const [x, y] of tiles) {
      expect(home[y * inner.terrain.width + x]).toBe(1);
      expect(inner.nearestWaterAccess([x, y])).not.toBeNull();
    }
  });
});
