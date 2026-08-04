import { describe, expect, it } from 'vitest';
import { SHEET_WIDTH, buildAtlas } from './build';
import { BASE_TERRAINS, EDGES, FOAM_EDGES, FOAM_FRAMES, TILE, VARIANTS } from './sprites/terrain';

describe('buildAtlas', () => {
  const atlas = buildAtlas();
  const tiles = atlas.sheets.find((sheet) => sheet.name === 'tiles')!;
  const entities = atlas.sheets.find((sheet) => sheet.name === 'entities')!;
  const ui = atlas.sheets.find((sheet) => sheet.name === 'ui')!;

  it('emits tiles, entities and ui sheets', () => {
    expect(atlas.sheets).toHaveLength(3);
    expect(tiles).toBeDefined();
    expect(entities).toBeDefined();
    expect(ui).toBeDefined();
    expect(atlas.manifest.sheets).toEqual({
      tiles: 'tiles.png',
      entities: 'entities.png',
      ui: 'ui.png',
    });
  });

  it('sizes each sheet buffer to its declared dimensions', () => {
    for (const sheet of atlas.sheets) {
      expect(sheet.width).toBe(SHEET_WIDTH);
      expect(sheet.rgba).toHaveLength(sheet.width * sheet.height * 4);
    }
  });

  it('emits a cell for every terrain variant', () => {
    for (const terrain of BASE_TERRAINS) {
      for (let variant = 0; variant < VARIANTS; variant += 1) {
        expect(atlas.manifest.cells[`terrain.${terrain}.${variant}`]).toBeDefined();
      }
    }
  });

  it('emits a fringe cell for every terrain and edge', () => {
    for (const terrain of BASE_TERRAINS) {
      for (const edge of EDGES) {
        expect(atlas.manifest.cells[`fringe.${terrain}.${edge}`]).toBeDefined();
      }
    }
  });

  it('emits a multi-frame foam cell for every foam edge', () => {
    for (const edge of FOAM_EDGES) {
      const cell = atlas.manifest.cells[`foam.${edge}`];
      expect(cell).toBeDefined();
      expect(cell.frames).toBe(FOAM_FRAMES);
      expect(cell.w).toBe(TILE);
    }
  });

  it('emits building, scaffold, crop, prop and villager cells', () => {
    for (const key of ['hut', 'farm', 'farm.field', 'granary', 'mill', 'bakery', 'scaffold.1', 'scaffold.2', 'scaffold.3']) {
      expect(atlas.manifest.cells[key], key).toBeDefined();
    }
    for (const stage of [0, 1, 2, 3]) {
      expect(atlas.manifest.cells[`wheat.${stage}`]).toBeDefined();
    }
    expect(atlas.manifest.cells['prop.cypress']).toBeDefined();
    expect(atlas.manifest.cells['prop.peak']).toBeDefined();
    expect(atlas.manifest.cells['villager.s.idle.0']).toBeDefined();
    expect(atlas.manifest.cells['villager.lie.3']).toBeDefined();
    expect(atlas.manifest.cells['bubble.tool']).toBeDefined();
  });

  it('marks animated buildings with frame counts', () => {
    expect(atlas.manifest.cells.mill.frames).toBe(4);
    expect(atlas.manifest.cells.bakery.frames).toBe(3);
    expect(atlas.manifest.cells['wheat.3'].frames).toBe(2);
  });

  it('keeps every cell inside its own sheet', () => {
    const byName = Object.fromEntries(atlas.sheets.map((sheet) => [sheet.name, sheet]));
    for (const [key, cell] of Object.entries(atlas.manifest.cells)) {
      const sheet = byName[cell.sheet];
      const span = cell.w * (cell.frames ?? 1);
      expect(cell.x + span, key).toBeLessThanOrEqual(sheet.width);
      expect(cell.y + cell.h, key).toBeLessThanOrEqual(sheet.height);
    }
  });

  it('is deterministic', () => {
    const again = buildAtlas();
    expect(again.manifest).toEqual(atlas.manifest);
    for (let i = 0; i < atlas.sheets.length; i += 1) {
      expect(Array.from(again.sheets[i].rgba)).toEqual(Array.from(atlas.sheets[i].rgba));
    }
  });

  it('writes actual pixels into every sheet', () => {
    expect(tiles.rgba.some((byte) => byte !== 0)).toBe(true);
    expect(entities.rgba.some((byte) => byte !== 0)).toBe(true);
    expect(ui.rgba.some((byte) => byte !== 0)).toBe(true);
  });

  it('emits Phase 3 ui cells', () => {
    expect(atlas.manifest.cells['ui.panel']).toBeDefined();
    expect(atlas.manifest.cells['font.strip'].h).toBe(14);
    expect(atlas.manifest.cells['ui.icon.wood']).toBeDefined();
    expect(atlas.manifest.cells['ui.bracket.tl']).toBeDefined();
  });
});
