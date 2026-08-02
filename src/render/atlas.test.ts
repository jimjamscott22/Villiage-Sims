import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AtlasCell, AtlasManifest } from './atlas';
import { cellRect, frameCount } from './atlas';

const single: AtlasCell = { sheet: 'tiles', x: 32, y: 16, w: 16, h: 16 };
const animated: AtlasCell = { sheet: 'tiles', x: 64, y: 0, w: 16, h: 16, frames: 3 };

describe('frameCount', () => {
  it('defaults to one frame', () => {
    expect(frameCount(single)).toBe(1);
  });

  it('reads the declared frame count', () => {
    expect(frameCount(animated)).toBe(3);
  });
});

describe('cellRect', () => {
  it('returns the cell rect for a single-frame cell', () => {
    expect(cellRect(single, 0)).toEqual([32, 16, 16, 16]);
  });

  it('steps horizontally by one frame width', () => {
    expect(cellRect(animated, 0)).toEqual([64, 0, 16, 16]);
    expect(cellRect(animated, 2)).toEqual([96, 0, 16, 16]);
  });

  it('wraps a frame index past the end', () => {
    expect(cellRect(animated, 3)).toEqual([64, 0, 16, 16]);
    expect(cellRect(animated, 4)).toEqual([80, 0, 16, 16]);
  });

  it('clamps a negative frame index to the first frame', () => {
    expect(cellRect(animated, -1)).toEqual([64, 0, 16, 16]);
  });
});

describe('committed manifest', () => {
  const manifest = JSON.parse(readFileSync('public/art/atlas.json', 'utf8')) as AtlasManifest;

  it('declares the tiles sheet', () => {
    expect(manifest.sheets.tiles).toBe('tiles.png');
  });

  it('covers all five base terrains with four variants each', () => {
    for (const terrain of ['deepWater', 'shallowWater', 'sand', 'grass', 'rock']) {
      for (let variant = 0; variant < 4; variant += 1) {
        expect(manifest.cells[`terrain.${terrain}.${variant}`]).toBeDefined();
      }
    }
  });

  it('gives every cell a positive size', () => {
    for (const [key, cell] of Object.entries(manifest.cells)) {
      expect(cell.w, key).toBeGreaterThan(0);
      expect(cell.h, key).toBeGreaterThan(0);
    }
  });
});
