import { describe, expect, it } from 'vitest';
import { baseTerrainOf, planTile, priorityOf, shorelineTiles, variantIndex } from './tilemap';

const DEEP = 0;
const SHALLOW = 1;
const SAND = 2;
const GRASS = 3;
const FOREST = 4;
const ROCK = 5;
const MOUNTAIN = 6;

/** Build a grid from rows of terrain bytes. */
function grid(rows: number[][]) {
  return { tiles: rows.flat(), width: rows[0].length, height: rows.length };
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
