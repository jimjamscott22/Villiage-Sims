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

/** Scatter boulder for bare rock tiles. 16×16, anchorY 0. */
export const BOULDER: SpriteGrid = grid(16, 16, {
  l: P.stoneLight,
  m: P.stoneMid,
  s: P.stoneShadow,
  i: P.ink,
}, (set) => {
  for (let y = 4; y <= 12; y += 1) {
    const half = Math.floor(2 + ((y - 4) / 8) * 4);
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      const edge = x === 8 - half || x === 7 + half || y === 4;
      if (edge) set(x, y, 's');
      else if (y <= 7 && x <= 8) set(x, y, 'l');
      else set(x, y, 'm');
    }
  }
  // Crack detail, then a contact shadow narrower than the base.
  set(9, 8, 's');
  set(9, 9, 's');
  set(10, 10, 's');
  for (let x = 4; x <= 11; x += 1) set(x, 13, 'i');
});

/** Berry shrub for open grass. 16×16, anchorY 0. */
export const BUSH: SpriteGrid = grid(16, 16, {
  d: P.vegDarkest,
  v: P.vegDark,
  m: P.vegMid,
  l: P.vegLight,
  b: P.terraMid,
}, (set) => {
  // Rounded mass lit from the north-west: pale crown, mid body, dark underside.
  for (let y = 3; y <= 12; y += 1) {
    const half = Math.floor(3 + Math.sin(((y - 3) / 9) * Math.PI) * 3);
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      const edge = x === 8 - half || x === 7 + half || y === 3;
      if (edge) set(x, y, 'd');
      else if (y <= 6 && x <= 8) set(x, y, 'l');
      else if (y >= 10 || x >= 11) set(x, y, 'v');
      else set(x, y, 'm');
    }
  }
  for (const [bx, by] of [[5, 6], [10, 8], [7, 10]]) set(bx, by, 'b');
  for (let x = 4; x <= 11; x += 1) set(x, 13, 'd');
});

/** Shoreline reeds. 16×16, anchorY 0, two sway frames. */
function reeds(sway: number): SpriteGrid {
  return grid(16, 16, {
    v: P.vegDark,
    m: P.vegMid,
    l: P.vegLight,
    w: P.wheat,
    s: P.sandShadow,
  }, (set) => {
    [3, 6, 9, 12].forEach((baseX, index) => {
      const height = 7 + (index % 2) * 3;
      const lean = sway === 0 ? 0 : index % 2 === 0 ? 1 : -1;
      for (let t = 0; t < height; t += 1) {
        const x = baseX + (t > height - 3 ? lean : 0);
        set(x, 13 - t, t < 2 ? 'v' : 'm');
      }
      set(baseX + lean, 13 - height, index % 2 === 0 ? 'w' : 'l');
    });
    for (let x = 2; x <= 13; x += 1) set(x, 14, 's');
  });
}

export const REEDS_SWAY: SpriteGrid[] = [reeds(0), reeds(1)];

/** Coastal palm. 16×32, anchorY 16. */
export const PALM: SpriteGrid = grid(16, 32, {
  t: P.sandMid,
  b: P.sandShadow,
  d: P.vegDarkest,
  v: P.vegDark,
  m: P.vegMid,
  l: P.vegLight,
  c: P.terraDark,
}, (set) => {
  // Trunk leans a little to the east as it rises.
  for (let y = 12; y <= 29; y += 1) {
    const lean = Math.floor((29 - y) / 6);
    set(7 + lean, y, 'b');
    set(8 + lean, y, 't');
  }
  const crownX = 9;
  const crownY = 12;
  const fronds = [
    { dx: -1, len: 6, dip: 1 },
    { dx: 1, len: 6, dip: 1 },
    { dx: -1, len: 4, dip: 3 },
    { dx: 1, len: 4, dip: 3 },
  ];
  for (const frond of fronds) {
    for (let i = 1; i <= frond.len; i += 1) {
      const x = crownX + frond.dx * i;
      const y = crownY - frond.dip + Math.floor((i * i) / 8);
      const tip = i > frond.len - 2;
      set(x, y, tip ? 'd' : 'v');
      set(x, y + 1, tip ? 'v' : 'm');
    }
  }
  set(crownX, crownY - 1, 'l');
  set(crownX, crownY, 'd');
  set(crownX - 1, crownY + 1, 'c');
  set(crownX + 1, crownY + 1, 'c');
  for (let x = 5; x <= 12; x += 1) set(x, 30, 'b');
});

export interface PropSprite {
  grid: SpriteGrid;
  anchorY: number;
  frames?: SpriteGrid[];
}

export const PROP_SPRITES: Record<string, PropSprite> = {
  'prop.cypress': { grid: CYPRESS, anchorY: 16 },
  'prop.peak': { grid: PEAK, anchorY: 8 },
  'prop.boulder': { grid: BOULDER, anchorY: 0 },
  'prop.bush': { grid: BUSH, anchorY: 0 },
  'prop.reeds': { grid: REEDS_SWAY[0], anchorY: 0, frames: REEDS_SWAY },
  'prop.palm': { grid: PALM, anchorY: 16 },
};
