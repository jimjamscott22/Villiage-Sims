import { describe, expect, it } from 'vitest';
import { BUILDING_DETAILS, BUILDING_ROOFS } from './buildingDetails';
import { BUILDING_SPRITES } from './buildings';
import { rasterizeGrid } from '../grid';

describe('building details', () => {
  it('keeps snow inside the opaque roof area and preserves dimensions and anchors', () => {
    for (const [key, [top, bottom]] of Object.entries(BUILDING_ROOFS)) {
      const base = BUILDING_SPRITES[key];
      const snow = BUILDING_DETAILS[`${key}.snow`];
      expect(snow.anchorY).toBe(base.anchorY);
      expect(snow.grid.size).toEqual(base.grid.size);
      const pixels = rasterizeGrid(snow.grid);
      let count = 0;
      for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
        if (!pixels.get(x, y)[3]) continue;
        count++;
        expect(y).toBeGreaterThanOrEqual(top);
        expect(y).toBeLessThanOrEqual(bottom);
        expect(base.grid.palette[base.grid.rows[y][x]]).toBeTruthy();
      }
      expect(count).toBeGreaterThan(0);
    }
  });
  it('uses 8×8 signs and 16×16 standing storage props', () => {
    for (const [key, entry] of Object.entries(BUILDING_DETAILS)) {
      if (key.endsWith('.sign')) expect(entry.grid.size).toEqual([8, 8]);
      if (key.startsWith('prop.')) expect(entry.grid.size).toEqual([16, 16]);
    }
  });
});
