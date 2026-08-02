import { describe, expect, it } from 'vitest';
import { SHEET_WIDTH, buildAtlas } from './build';
import { BASE_TERRAINS, EDGES, FOAM_EDGES, FOAM_FRAMES, TILE, VARIANTS } from './sprites/terrain';

describe('buildAtlas', () => {
  const atlas = buildAtlas();

  it('emits a single tiles sheet', () => {
    expect(atlas.sheets).toHaveLength(1);
    expect(atlas.sheets[0].name).toBe('tiles');
    expect(atlas.manifest.sheets).toEqual({ tiles: 'tiles.png' });
  });

  it('sizes the sheet buffer to its declared dimensions', () => {
    const sheet = atlas.sheets[0];
    expect(sheet.width).toBe(SHEET_WIDTH);
    expect(sheet.rgba).toHaveLength(sheet.width * sheet.height * 4);
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

  it('emits exactly the expected number of cells', () => {
    const expected =
      BASE_TERRAINS.length * VARIANTS + BASE_TERRAINS.length * EDGES.length + FOAM_EDGES.length;
    expect(Object.keys(atlas.manifest.cells)).toHaveLength(expected);
  });

  it('keeps every cell, including all its frames, inside the sheet', () => {
    const sheet = atlas.sheets[0];
    for (const [key, cell] of Object.entries(atlas.manifest.cells)) {
      const span = cell.w * (cell.frames ?? 1);
      expect(cell.x + span, key).toBeLessThanOrEqual(sheet.width);
      expect(cell.y + cell.h, key).toBeLessThanOrEqual(sheet.height);
    }
  });

  it('is deterministic', () => {
    const again = buildAtlas();
    expect(again.manifest).toEqual(atlas.manifest);
    expect(Array.from(again.sheets[0].rgba)).toEqual(Array.from(atlas.sheets[0].rgba));
  });

  it('writes actual pixels into the sheet', () => {
    expect(atlas.sheets[0].rgba.some((byte) => byte !== 0)).toBe(true);
  });
});
