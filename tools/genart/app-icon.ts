import { rasterizeGrid, remapColor } from './grid';
import { PALETTE, toRgba } from './palette';
import { Raster } from './raster';
import { HUT } from './sprites/buildings';
import { WHEAT_STAGES } from './sprites/crops';
import { BUSH, CYPRESS, REEDS_SWAY } from './sprites/props';
import { makeBaseTile } from './sprites/terrain';
import { DYE_PLACEHOLDER, VILLAGER_POSES } from './sprites/villagers';

/** Native pixel-art canvas. Scaled 16× to the 1024 source icon. */
export const APP_ICON_NATIVE = 64;
export const APP_ICON_SCALE = 16;
export const APP_ICON_SIZE = APP_ICON_NATIVE * APP_ICON_SCALE;

const CX = 32;
const CY = 34;

function tileAt(terrain: 'grass' | 'deepWater' | 'shallowWater' | 'sand', x: number, y: number) {
  const variant = ((x >> 4) + (y >> 4) * 3) & 3;
  const tile = makeBaseTile(terrain, variant);
  return tile.get(((x % 16) + 16) % 16, ((y % 16) + 16) % 16);
}

/** A round grassy island: hut, wheat, villager, cypress. Transparent corners. */
export function renderAppIconNative(): Raster {
  const canvas = new Raster(APP_ICON_NATIVE, APP_ICON_NATIVE);
  const ink = toRgba('ink');
  const foam = toRgba('foam');

  for (let y = 0; y < APP_ICON_NATIVE; y += 1) {
    for (let x = 0; x < APP_ICON_NATIVE; x += 1) {
      const d = Math.hypot(x - CX, y - CY);
      if (d > 30) continue;
      if (d > 29) {
        canvas.set(x, y, ink);
      } else if (d > 26) {
        canvas.set(x, y, tileAt('deepWater', x, y));
      } else if (d > 24) {
        const foamSpark = (x * 3 + y * 7) % 5 === 0;
        canvas.set(x, y, foamSpark ? foam : tileAt('shallowWater', x, y));
      } else if (d > 22) {
        canvas.set(x, y, tileAt('sand', x, y));
      } else {
        canvas.set(x, y, tileAt('grass', x, y));
      }
    }
  }

  const villager = remapColor(
    rasterizeGrid(VILLAGER_POSES['s.idle']),
    DYE_PLACEHOLDER,
    PALETTE.terraMid,
  );

  canvas.blit(rasterizeGrid(CYPRESS), 2, 8);
  canvas.blit(rasterizeGrid(BUSH), 42, 18);
  canvas.blit(rasterizeGrid(HUT), 24, 10);
  canvas.blit(rasterizeGrid(WHEAT_STAGES[3]), 42, 26);
  canvas.blit(villager, 14, 32);
  canvas.blit(rasterizeGrid(REEDS_SWAY[0]), 4, 40);

  return canvas;
}

export function renderAppIcon(): Raster {
  return renderAppIconNative().scale(APP_ICON_SCALE);
}

function downsample(source: Raster, factor: number): Raster {
  if (!Number.isInteger(factor) || factor < 2) {
    throw new Error(`downsample: factor must be an integer >= 2, got ${factor}`);
  }
  if (source.width % factor !== 0 || source.height % factor !== 0) {
    throw new Error(`downsample: ${source.width}×${source.height} is not divisible by ${factor}`);
  }
  const out = new Raster(source.width / factor, source.height / factor);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const pixel = source.get(x * factor, y * factor);
      if (pixel[3] === 0) continue;
      out.set(x, y, pixel);
    }
  }
  return out;
}

/** Crisp desktop PNG sizes. Integer scale from the 64×64 native canvas. */
export const DESKTOP_PNGS: ReadonlyArray<{ file: string; size: number }> = [
  { file: '32x32.png', size: 32 },
  { file: '64x64.png', size: 64 },
  { file: '128x128.png', size: 128 },
  { file: '128x128@2x.png', size: 256 },
  { file: 'icon.png', size: 512 },
];

export function rasterForIconSize(size: number): Raster {
  const native = renderAppIconNative();
  if (size === native.width) return native;
  if (size < native.width) return downsample(native, native.width / size);
  const factor = size / native.width;
  return native.scale(factor);
}
