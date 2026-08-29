import { describe, expect, it } from 'vitest';
import { baseTerrainOf, planTile, priorityOf, shorelineTiles, terrainProps, variantIndex } from './tilemap';

const DEEP = 0;
const SHALLOW = 1;
const SAND = 2;
const GRASS = 3;
const FOREST = 4;
const ROCK = 5;
const MOUNTAIN = 6;

/** Build a grid from rows of terrain bytes. */
function grid(rows: number[][]) {
  return { tiles: rows.flat(), width: rows[0].length, height: rows.length, tileSize: 32 };
}

describe('baseTerrainOf', () => {
  it('maps the five base terrains to themselves', () => {
    expect(baseTerrainOf(DEEP)).toBe('deepWater');
    expect(baseTerrainOf(SHALLOW)).toBe('shallowWater');
    expect(baseTerrainOf(SAND)).toBe('sand');
    expect(baseTerrainOf(GRASS)).toBe('grass');
    expect(baseTerrainOf(ROCK)).toBe('rock');
  });

  it('maps forest onto grass and mountain onto rock', () => {
    expect(baseTerrainOf(FOREST)).toBe('grass');
    expect(baseTerrainOf(MOUNTAIN)).toBe('rock');
  });
});

describe('priorityOf', () => {
  it('orders water below sand below grass below rock', () => {
    expect(priorityOf(DEEP)).toBeLessThan(priorityOf(SHALLOW));
    expect(priorityOf(SHALLOW)).toBeLessThan(priorityOf(SAND));
    expect(priorityOf(SAND)).toBeLessThan(priorityOf(GRASS));
    expect(priorityOf(GRASS)).toBeLessThan(priorityOf(ROCK));
  });

  it('gives forest grass priority and mountain rock priority', () => {
    expect(priorityOf(FOREST)).toBe(priorityOf(GRASS));
    expect(priorityOf(MOUNTAIN)).toBe(priorityOf(ROCK));
  });
});

describe('variantIndex', () => {
  it('stays within 0..3', () => {
    for (let x = 0; x < 30; x += 1) {
      for (let y = 0; y < 30; y += 1) {
        const index = variantIndex(x, y);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(4);
      }
    }
  });

  it('is stable for a coordinate', () => {
    expect(variantIndex(9, 4)).toBe(variantIndex(9, 4));
  });

  it('uses more than one variant across a region', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 20; x += 1) for (let y = 0; y < 20; y += 1) seen.add(variantIndex(x, y));
    expect(seen.size).toBe(4);
  });
});

describe('planTile', () => {
  it('names the base cell from the terrain and variant', () => {
    const g = grid([[GRASS]]);
    const plan = planTile(g.tiles, g.width, g.height, 0, 0);
    expect(plan.base).toBe(`terrain.grass.${variantIndex(0, 0)}`);
  });

  it('adds no fringes on a uniform grid', () => {
    const g = grid([
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toEqual([]);
  });

  it('fringes the higher neighbour onto the lower tile', () => {
    const g = grid([
      [GRASS, GRASS, GRASS],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toContain('fringe.grass.n');
  });

  it('never fringes a lower neighbour onto a higher tile', () => {
    const g = grid([
      [GRASS, GRASS, GRASS],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 0).fringes).toEqual([]);
  });

  it('uses an outer corner where two adjacent sides are higher', () => {
    const g = grid([
      [GRASS, GRASS, SAND],
      [GRASS, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toContain('fringe.grass.nwOut');
  });

  it('uses an inner corner where only the diagonal is higher', () => {
    const g = grid([
      [GRASS, SAND, SAND],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    const plan = planTile(g.tiles, g.width, g.height, 1, 1);
    expect(plan.fringes).toContain('fringe.grass.nwIn');
    expect(plan.fringes).not.toContain('fringe.grass.nwOut');
  });

  it('treats forest as grass when fringing', () => {
    const g = grid([
      [FOREST, FOREST, FOREST],
      [SAND, SAND, SAND],
      [SAND, SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 1, 1).fringes).toContain('fringe.grass.n');
  });

  it('does not fringe against out-of-bounds neighbours', () => {
    const g = grid([
      [SAND, SAND],
      [SAND, SAND],
    ]);
    expect(planTile(g.tiles, g.width, g.height, 0, 0).fringes).toEqual([]);
  });

  it('orders fringes deterministically when two terrains meet', () => {
    const g = grid([
      [GRASS, GRASS, GRASS],
      [SHALLOW, SAND, ROCK],
      [SAND, SAND, SAND],
    ]);
    const first = planTile(g.tiles, g.width, g.height, 1, 1).fringes;
    const second = planTile(g.tiles, g.width, g.height, 1, 1).fringes;
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
  });
});

describe('shorelineTiles', () => {
  const terrain = (rows: number[][]) => ({
    ...grid(rows),
    tileSize: 32,
  });

  it('finds water tiles that touch land', () => {
    const found = shorelineTiles(terrain([
      [DEEP, SHALLOW, SAND],
      [DEEP, SHALLOW, SAND],
      [DEEP, SHALLOW, SAND],
    ]));
    expect(found.some((tile) => tile.x === 1 && tile.y === 1)).toBe(true);
  });

  it('records the edge facing the land', () => {
    const found = shorelineTiles(terrain([
      [DEEP, DEEP, DEEP],
      [DEEP, SHALLOW, DEEP],
      [DEEP, SAND, DEEP],
    ]));
    const tile = found.find((candidate) => candidate.x === 1 && candidate.y === 1);
    expect(tile?.edges).toContain('foam.s');
  });

  it('ignores land tiles entirely', () => {
    const found = shorelineTiles(terrain([
      [SAND, GRASS],
      [SAND, GRASS],
    ]));
    expect(found).toEqual([]);
  });

  it('ignores open water with no land nearby', () => {
    const found = shorelineTiles(terrain([
      [DEEP, DEEP],
      [DEEP, DEEP],
    ]));
    expect(found).toEqual([]);
  });

  it('adds an outer corner where two sides face land', () => {
    const found = shorelineTiles(terrain([
      [DEEP, SAND, DEEP],
      [SAND, SHALLOW, DEEP],
      [DEEP, DEEP, DEEP],
    ]));
    const tile = found.find((candidate) => candidate.x === 1 && candidate.y === 1);
    expect(tile?.edges).toContain('foam.nwOut');
  });
});

describe('terrainProps', () => {
  it('emits cypress for forest and peak for mountain', () => {
    const props = terrainProps({
      width: 3,
      height: 2,
      tileSize: 32,
      tiles: [GRASS, FOREST, ROCK, SAND, MOUNTAIN, GRASS],
    });
    expect(props.filter((prop) => !prop.decor)).toEqual([
      { x: 1, y: 0, key: 'prop.cypress' },
      { x: 1, y: 1, key: 'prop.peak' },
    ]);
  });

  it('scatters decor only on grass, sand and rock', () => {
    const rows = Array.from({ length: 24 }, (_, y) =>
      Array.from({ length: 24 }, (_, x) => [GRASS, SAND, ROCK, FOREST, MOUNTAIN][(x + y) % 5]),
    );
    const props = terrainProps(grid(rows));
    const decor = props.filter((prop) => prop.decor);
    expect(decor.length).toBeGreaterThan(0);
    const grassKeys = new Set(['prop.bush', 'prop.flowers', 'prop.stump', 'prop.deadfall', 'prop.mushroom']);
    const sandKeys = new Set(['prop.palm', 'prop.reeds', 'prop.shoreRock', 'prop.driftwood']);
    for (const prop of decor) {
      const terrain = rows[prop.y][prop.x];
      expect([GRASS, SAND, ROCK]).toContain(terrain);
      if (terrain === GRASS) expect(grassKeys.has(prop.key)).toBe(true);
      if (terrain === ROCK) expect(prop.key).toBe('prop.boulder');
      if (terrain === SAND) expect(sandKeys.has(prop.key)).toBe(true);
    }
  });

  it('tags spring flowers with season 0', () => {
    const rows = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => GRASS));
    const flowers = terrainProps(grid(rows)).filter((prop) => prop.key === 'prop.flowers');
    expect(flowers.length).toBeGreaterThan(0);
    expect(flowers.every((prop) => prop.season === 0)).toBe(true);
  });

  it('places forest-edge debris beside cypress tiles', () => {
    const rows = Array.from({ length: 8 }, () =>
      Array.from({ length: 16 }, (_, x) => (x === 0 ? FOREST : GRASS)),
    );
    const edgeKeys = terrainProps(grid(rows))
      .filter((prop) => prop.x === 1)
      .map((prop) => prop.key);
    const forestEdge = ['prop.stump', 'prop.deadfall', 'prop.mushroom'];
    expect(edgeKeys.some((key) => forestEdge.includes(key))).toBe(true);
  });

  it('is deterministic for the same tiles', () => {
    const rows = Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => (x * y) % 4 === 0 ? GRASS : ROCK),
    );
    expect(terrainProps(grid(rows))).toEqual(terrainProps(grid(rows)));
  });

  it('picks reeds on sand that touches water and palms inland', () => {
    // A one-tile sand strip: the left cell borders shallow water, the right does not.
    const rows = [
      [SAND, SAND, SAND, SAND],
      [SHALLOW, GRASS, GRASS, GRASS],
    ];
    const sandKeys = new Set(
      terrainProps(grid(rows))
        .filter((prop) => prop.y === 0)
        .map((prop) => prop.key),
    );
    expect([...sandKeys].every((key) => key === 'prop.reeds' || key === 'prop.palm')).toBe(true);
    expect(sandKeys.has('prop.reeds')).toBe(true);
  });
});
