import { describe, expect, it } from 'vitest';
import { mirrorHorizontal, outlineGrid, paintGrid, rasterizeGrid, remapColor } from './grid';
import { PALETTE } from './palette';

describe('rasterizeGrid', () => {
  it('rasterizes a tiny grid with transparent and opaque pixels', () => {
    const raster = rasterizeGrid({
      size: [2, 2],
      palette: { '.': null, w: PALETTE.whitewash, t: PALETTE.terraMid },
      rows: ['w.', '.t'],
    });
    expect(raster.width).toBe(2);
    expect(raster.height).toBe(2);
    expect(raster.get(0, 0)).toEqual([0xf2, 0xec, 0xe0, 255]);
    expect(raster.get(1, 0)).toEqual([0, 0, 0, 0]);
    expect(raster.get(1, 1)).toEqual([0xc0, 0x5a, 0x34, 255]);
  });

  it('rejects colors outside the palette', () => {
    expect(() =>
      rasterizeGrid({
        size: [1, 1],
        palette: { x: '#ff00ff' },
        rows: ['x'],
      }),
    ).toThrow(/not in the palette/);
  });

  it('rejects a row-count mismatch', () => {
    expect(() =>
      rasterizeGrid({
        size: [1, 2],
        palette: { '.': null },
        rows: ['.'],
      }),
    ).toThrow(/Expected 2 rows/);
  });

  it('rejects an unknown key in the grid', () => {
    expect(() =>
      rasterizeGrid({
        size: [1, 1],
        palette: { '.': null },
        rows: ['z'],
      }),
    ).toThrow(/Unknown palette key 'z'/);
  });
});

describe('mirrorHorizontal', () => {
  it('flips pixels left-to-right', () => {
    const source = rasterizeGrid({
      size: [2, 1],
      palette: { '.': null, w: PALETTE.whitewash },
      rows: ['w.'],
    });
    const mirrored = mirrorHorizontal(source);
    expect(mirrored.get(0, 0)).toEqual([0, 0, 0, 0]);
    expect(mirrored.get(1, 0)).toEqual([0xf2, 0xec, 0xe0, 255]);
  });
});

describe('remapColor', () => {
  it('replaces the dye placeholder', () => {
    const source = rasterizeGrid({
      size: [2, 1],
      palette: { d: PALETTE.shutter, i: PALETTE.ink },
      rows: ['di'],
    });
    const remapped = remapColor(source, PALETTE.shutter, PALETTE.terraMid);
    expect(remapped.get(0, 0)).toEqual([0xc0, 0x5a, 0x34, 255]);
    expect(remapped.get(1, 0)).toEqual([0x2b, 0x23, 0x20, 255]);
  });
});

describe('outlineGrid', () => {
  const pal = { '.': null, w: PALETTE.whitewash, i: PALETTE.ink };

  it('rings the silhouette with the outline key without growing the cell', () => {
    const out = outlineGrid({ size: [5, 5], palette: pal, rows: ['.....', '.....', '..w..', '.....', '.....'] }, 'i');
    expect(out.size).toEqual([5, 5]);
    expect(out.rows).toEqual(['.....', '..i..', '.iwi.', '..i..', '.....']);
  });

  it('leaves sides that touch the cell edge unoutlined', () => {
    const out = outlineGrid({ size: [3, 2], palette: pal, rows: ['www', '...'] }, 'i');
    expect(out.rows).toEqual(['www', 'iii']);
  });

  it('rejects a transparent or missing outline key', () => {
    expect(() => outlineGrid({ size: [1, 1], palette: pal, rows: ['w'] }, '.')).toThrow();
    expect(() => outlineGrid({ size: [1, 1], palette: pal, rows: ['w'] }, 'z')).toThrow();
  });
});

describe('paintGrid', () => {
  it('paints over a copy and leaves the source untouched', () => {
    const source = { size: [2, 1] as [number, number], palette: { '.': null, w: PALETTE.whitewash }, rows: ['..'] };
    const painted = paintGrid(source, (set) => set(1, 0, 'w'));
    expect(painted.rows).toEqual(['.w']);
    expect(source.rows).toEqual(['..']);
  });
});
