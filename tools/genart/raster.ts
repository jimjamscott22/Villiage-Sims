import type { Rgba } from './palette';

/** A mutable RGBA pixel buffer. Knows nothing about sprites or the palette. */
export class Raster {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rgba = new Uint8Array(width * height * 4);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: Rgba): void {
    if (!this.inBounds(x, y)) return;
    const index = (y * this.width + x) * 4;
    this.rgba[index] = color[0];
    this.rgba[index + 1] = color[1];
    this.rgba[index + 2] = color[2];
    this.rgba[index + 3] = color[3];
  }

  get(x: number, y: number): Rgba {
    const index = (y * this.width + x) * 4;
    return [this.rgba[index], this.rgba[index + 1], this.rgba[index + 2], this.rgba[index + 3]];
  }

  /** Copy `source` in at (dx, dy). Fully transparent source pixels are skipped. */
  blit(source: Raster, dx: number, dy: number): void {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const pixel = source.get(x, y);
        if (pixel[3] === 0) continue;
        this.set(dx + x, dy + y, pixel);
      }
    }
  }
}
