import { PALETTE } from '../palette';
import type { SpriteGrid } from '../grid';

const P = PALETTE;

type Pal = Record<string, string | null>;

function grid(width: number, height: number, palette: Pal, paint: (set: (x: number, y: number, k: string) => void) => void): SpriteGrid {
  const cells: string[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => '.'));
  const set = (x: number, y: number, k: string) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    cells[y][x] = k;
  };
  paint(set);
  return {
    size: [width, height],
    palette: { '.': null, ...palette },
    rows: cells.map((row) => row.join('')),
  };
}

/** Cypress cluster. 16×32, anchorY 16. */
export const CYPRESS: SpriteGrid = grid(16, 32, {
  d: P.vegDarkest,
  v: P.vegDark,
  m: P.vegMid,
  s: P.stoneShadow,
}, (set) => {
  for (let y = 0; y <= 22; y += 1) {
    const t = y / 22;
    const half = Math.max(1, Math.floor(1 + (1 - Math.abs(t - 0.45) * 1.6) * 5));
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      const edge = x === 8 - half || x === 7 + half;
      set(x, y, edge ? 'd' : y % 3 === 0 ? 'm' : 'v');
    }
  }
  for (let y = 23; y <= 28; y += 1) {
    set(7, y, 's');
    set(8, y, 's');
  }
  for (let x = 4; x <= 11; x += 1) {
    set(x, 29, 'd');
    set(x, 30, 'd');
  }
});

/** Mountain peak. 16×24, anchorY 8. */
export const PEAK: SpriteGrid = grid(16, 24, {
  p: P.stonePale,
  l: P.stoneLight,
  m: P.stoneMid,
  s: P.stoneShadow,
  i: P.ink,
}, (set) => {
  for (let y = 0; y <= 15; y += 1) {
    const half = Math.floor(y * 0.7) + 1;
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      const top = y < 3;
      const edge = x === 8 - half || x === 7 + half;
      set(x, y, top ? 'p' : edge ? 's' : y < 8 ? 'l' : 'm');
    }
  }
  for (let y = 16; y <= 20; y += 1) {
    for (let x = 2; x <= 13; x += 1) set(x, y, 's');
  }
  for (let x = 4; x <= 11; x += 1) {
    set(x, 21, 'i');
    set(x, 22, 'i');
  }
});

export interface PropSprite {
  grid: SpriteGrid;
  anchorY: number;
  frames?: SpriteGrid[];
}

export const PROP_SPRITES: Record<string, PropSprite> = {
  'prop.cypress': { grid: CYPRESS, anchorY: 16 },
  'prop.peak': { grid: PEAK, anchorY: 8 },
};
