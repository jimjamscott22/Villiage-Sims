import { describe, expect, it } from 'vitest';
import { Raster } from './raster';
import type { Rgba } from './palette';

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

describe('Raster', () => {
  it('starts fully transparent', () => {
    const raster = new Raster(2, 2);
    expect(Array.from(raster.rgba)).toEqual(new Array(16).fill(0));
  });

  it('sets and reads a pixel', () => {
    const raster = new Raster(3, 3);
    raster.set(1, 2, RED);
    expect(raster.get(1, 2)).toEqual(RED);
  });

  it('ignores out-of-bounds writes instead of corrupting neighbours', () => {
    const raster = new Raster(2, 2);
    raster.set(-1, 0, RED);
    raster.set(2, 0, RED);
    raster.set(0, 5, RED);
    expect(Array.from(raster.rgba)).toEqual(new Array(16).fill(0));
  });

  it('returns fully transparent for out-of-bounds reads', () => {
    const raster = new Raster(2, 2);
    raster.set(0, 0, RED);
    expect(raster.get(-1, 0)).toEqual([0, 0, 0, 0]);
    expect(raster.get(2, 0)).toEqual([0, 0, 0, 0]);
    expect(raster.get(0, 5)).toEqual([0, 0, 0, 0]);
  });

  it('blits a source raster at an offset', () => {
    const source = new Raster(1, 1);
    source.set(0, 0, BLUE);
    const target = new Raster(3, 3);
    target.blit(source, 2, 1);
    expect(target.get(2, 1)).toEqual(BLUE);
    expect(target.get(0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('skips fully transparent source pixels when blitting', () => {
    const source = new Raster(2, 1);
    source.set(1, 0, BLUE);
    const target = new Raster(2, 1);
    target.set(0, 0, RED);
    target.blit(source, 0, 0);
    expect(target.get(0, 0)).toEqual(RED);
    expect(target.get(1, 0)).toEqual(BLUE);
  });
});
