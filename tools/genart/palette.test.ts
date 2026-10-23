import { describe, expect, it } from 'vitest';
import { hash01 } from './hash';
import { PALETTE, THEME, UI_TOKENS, assertPaletteHex, toRgba } from './palette';

describe('PALETTE', () => {
  it('holds exactly the 25 locked art colors', () => {
    expect(Object.keys(PALETTE)).toHaveLength(25);
  });

  it('adds exactly two UI-only colours plus the uiText alias', () => {
    expect(Object.keys(UI_TOKENS)).toEqual(['uiBg', 'highlight', 'uiText']);
    expect(new Set(Object.values(THEME)).size).toBe(27);
  });

  it('has no duplicate hex values', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
  });

  it('converts hex to RGBA', () => {
    expect(toRgba('whitewash')).toEqual([242, 236, 224, 255]);
    expect(toRgba('ink')).toEqual([43, 35, 32, 255]);
  });
});

describe('assertPaletteHex', () => {
  it('returns the palette name for a member color', () => {
    expect(assertPaletteHex('#2fa0a8')).toBe('seaShallow');
  });

  it('throws for a color outside the palette', () => {
    expect(() => assertPaletteHex('#ff00ff')).toThrow(/not in the palette/);
  });
});

describe('hash01', () => {
  it('is stable for the same inputs', () => {
    expect(hash01(7, 11, 3)).toBe(hash01(7, 11, 3));
  });

  it('stays within [0, 1)', () => {
    for (let x = 0; x < 40; x += 1) {
      for (let y = 0; y < 40; y += 1) {
        const value = hash01(x, y, 1);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it('decorrelates neighbouring coordinates', () => {
    const samples = [hash01(0, 0, 0), hash01(1, 0, 0), hash01(0, 1, 0), hash01(1, 1, 0)];
    expect(new Set(samples).size).toBe(4);
  });

  it('spreads roughly uniformly across quarters', () => {
    const buckets = [0, 0, 0, 0];
    for (let x = 0; x < 100; x += 1) {
      for (let y = 0; y < 100; y += 1) buckets[Math.floor(hash01(x, y, 5) * 4)] += 1;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(1800);
  });
});

describe('THEME', () => {
  it('adds only the UI tokens on top of the art palette', () => {
    expect(Object.keys(THEME)).toEqual([...Object.keys(PALETTE), ...Object.keys(UI_TOKENS)]);
    expect(UI_TOKENS.uiText).toBe(PALETTE.whitewash);
  });

  it('keeps UI-only colours out of the art palette', () => {
    expect(() => assertPaletteHex(UI_TOKENS.uiBg)).toThrow();
    expect(() => assertPaletteHex(UI_TOKENS.highlight)).toThrow();
  });
});
