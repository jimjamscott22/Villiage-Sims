import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_ICON_SIZE, DESKTOP_PNGS, rasterForIconSize, renderAppIcon, renderAppIconNative } from './app-icon';
import { PALETTE } from './palette';
import { APP_ICON_PATH, ICONS_DIR } from './paths';
import { decodePng } from './png';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const PALETTE_RGB = new Set(
  Object.values(PALETTE).map((hex) => hex.slice(1).toLowerCase()),
);

function rgbKey(r: number, g: number, b: number): string {
  return [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function assertRgba8(png: Uint8Array) {
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(png[24]).toBe(8);
  expect(png[25]).toBe(6);
}

describe('app icon composition', () => {
  it('is 1024×1024 with transparent corners and a solid island', () => {
    const icon = renderAppIcon();
    expect(icon.width).toBe(APP_ICON_SIZE);
    expect(icon.height).toBe(APP_ICON_SIZE);
    expect(icon.get(0, 0)[3]).toBe(0);
    expect(icon.get(APP_ICON_SIZE - 1, 0)[3]).toBe(0);
    expect(icon.get(0, APP_ICON_SIZE - 1)[3]).toBe(0);
    expect(icon.get(APP_ICON_SIZE - 1, APP_ICON_SIZE - 1)[3]).toBe(0);
    expect(icon.get(APP_ICON_SIZE / 2, APP_ICON_SIZE / 2)[3]).toBe(255);
  });

  it('uses only palette colors on opaque pixels', () => {
    const native = renderAppIconNative();
    for (let y = 0; y < native.height; y += 1) {
      for (let x = 0; x < native.width; x += 1) {
        const [r, g, b, a] = native.get(x, y);
        if (a === 0) continue;
        expect(PALETTE_RGB.has(rgbKey(r, g, b)), `off-palette at ${x},${y}`).toBe(true);
      }
    }
  });
});

describe('committed app-icon.png', () => {
  it('is an 8-bit RGBA PNG matching the composer', () => {
    const png = readFileSync(APP_ICON_PATH);
    assertRgba8(png);
    const decoded = decodePng(png);
    const expected = renderAppIcon();
    expect(decoded.width).toBe(expected.width);
    expect(decoded.height).toBe(expected.height);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(expected.rgba));
  });
});

describe('Tauri desktop icon', () => {
  it('is an 8-bit RGBA PNG matching the composer at each size', () => {
    for (const { file, size } of DESKTOP_PNGS) {
      const png = readFileSync(join(ICONS_DIR, file));
      assertRgba8(png);
      const decoded = decodePng(png);
      const expected = rasterForIconSize(size);
      expect(decoded.width, file).toBe(expected.width);
      expect(decoded.height, file).toBe(expected.height);
      expect(Array.from(decoded.rgba)).toEqual(Array.from(expected.rgba));
    }
  });

  it('does not ship iOS or Android icon sets', () => {
    expect(existsSync(join(repoRoot, 'src-tauri', 'icons', 'ios'))).toBe(false);
    expect(existsSync(join(repoRoot, 'src-tauri', 'icons', 'android'))).toBe(false);
  });
});
