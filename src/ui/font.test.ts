import { describe, expect, it } from 'vitest';
import { FONT_GLYPHS, glyphBackgroundPosition, glyphBackgroundX, glyphIndex, normalizePixelText } from './font';

describe('glyphIndex', () => {
  it('maps uppercase letters and digits', () => {
    expect(glyphIndex('A')).toBe(1);
    expect(glyphIndex('a')).toBe(1);
    expect(glyphIndex('0')).toBe(27);
  });

  it('returns -1 for unsupported characters', () => {
    expect(glyphIndex('*')).toBe(-1);
    expect(glyphIndex('ñ')).toBe(-1);
  });
});

describe('normalizePixelText', () => {
  it('uppercases and drops unsupported glyphs', () => {
    expect(normalizePixelText('Day 12 · Spring')).toBe('DAY 12  SPRING');
    expect(normalizePixelText('pop*')).toBe('POP');
  });
});

describe('glyphBackgroundX', () => {
  it('steps by glyph width times scale', () => {
    expect(glyphBackgroundX(' ')).toBe(0);
    expect(glyphBackgroundX('A')).toBe(-12);
    expect(glyphBackgroundX('B')).toBe(-24);
  });
});

describe('glyphBackgroundPosition', () => {
  it('wraps to the second row after 24 glyphs', () => {
    expect(glyphBackgroundPosition('X')).toEqual({ x: 0, y: -14 });
    expect(glyphBackgroundPosition('0')).toEqual({ x: -36, y: -14 });
    expect(glyphBackgroundPosition('9')).toEqual({ x: -144, y: -14 });
  });
});

describe('FONT_GLYPHS', () => {
  it('has 48 glyphs', () => {
    expect(FONT_GLYPHS.length).toBe(48);
  });
});
