import { describe, expect, it } from 'vitest';
import { decodePng, encodePng } from './png';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe('encodePng', () => {
  it('writes the PNG signature', () => {
    const png = encodePng(1, 1, new Uint8Array([255, 0, 0, 255]));
    expect(Array.from(png.subarray(0, 8))).toEqual(SIGNATURE);
  });

  it('round-trips pixel data through decodePng', () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 0,
    ]);
    const decoded = decodePng(encodePng(2, 2, rgba));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(rgba));
  });

  it('is deterministic for identical input', () => {
    const rgba = new Uint8Array(4 * 16).fill(120);
    expect(Array.from(encodePng(4, 4, rgba))).toEqual(Array.from(encodePng(4, 4, rgba)));
  });

  it('rejects a buffer whose length does not match the dimensions', () => {
    expect(() => encodePng(2, 2, new Uint8Array(4))).toThrow(/expected 16 bytes/);
  });
});
