import { describe, expect, it } from 'vitest';
import { FONT_GLYPHS, GLYPH_HEIGHT, GLYPH_WIDTH } from '../ui/font';
import { bitmapTextContent, bitmapTextHeight, bitmapTextWidth, glyphSourceRect } from './bitmapText';

describe('bitmap text metrics', () => {
  it('advances 6px per glyph at the given scale', () => {
    expect(bitmapTextWidth('Ash')).toBe(3 * GLYPH_WIDTH * 2);
    expect(bitmapTextWidth('Ash', 1)).toBe(3 * GLYPH_WIDTH);
    expect(bitmapTextHeight()).toBe(GLYPH_HEIGHT * 2);
  });

  it('measures only glyphs the strip can draw', () => {
    expect(bitmapTextContent('Ash #3')).toBe('ASH 3');
    expect(bitmapTextWidth('Ash #3')).toBe(5 * GLYPH_WIDTH * 2);
  });

  it('maps dashes and ellipses to ASCII glyphs', () => {
    expect(bitmapTextContent('Home — Sleeping')).toBe('HOME - SLEEPING');
    expect(bitmapTextContent('Hmm…')).toBe('HMM...');
  });
});

describe('glyphSourceRect', () => {
  const origin = { x: 0, y: 18 };

  it('locates glyphs on both strip rows', () => {
    expect(glyphSourceRect(' ', origin)).toEqual([0, 18, 6, 7]);
    expect(glyphSourceRect('a', origin)).toEqual([6, 18, 6, 7]);
    const last = FONT_GLYPHS[FONT_GLYPHS.length - 1];
    expect(glyphSourceRect(last, origin)).toEqual([23 * 6, 25, 6, 7]);
  });

  it('returns null for characters outside the strip', () => {
    expect(glyphSourceRect('#', origin)).toBeNull();
  });
});
