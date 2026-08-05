import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAtlas } from './build';
import { rasterizeGrid } from './grid';
import { ART_DIR } from './paths';
import { decodePng } from './png';
import { PANEL } from './sprites/ui';

// The committed PNG is compared by decoded pixels, not raw bytes: zlib output
// varies with the Node version, so a byte comparison would fail spuriously.
describe('committed art', () => {
  const atlas = buildAtlas();

  it('matches the committed manifest', () => {
    const committed = JSON.parse(readFileSync(join(ART_DIR, 'atlas.json'), 'utf8'));
    expect(committed).toEqual(atlas.manifest);
  });

  it('matches the committed sheet pixels', () => {
    for (const sheet of atlas.sheets) {
      const decoded = decodePng(readFileSync(join(ART_DIR, `${sheet.name}.png`)));
      expect(decoded.width).toBe(sheet.width);
      expect(decoded.height).toBe(sheet.height);
      expect(Array.from(decoded.rgba)).toEqual(Array.from(sheet.rgba));
    }
  });

  it('matches the committed border-image panel frame', () => {
    const expected = rasterizeGrid(PANEL);
    const decoded = decodePng(readFileSync(join(ART_DIR, 'panel.png')));
    expect(decoded.width).toBe(expected.width);
    expect(decoded.height).toBe(expected.height);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(expected.rgba));
  });
});
