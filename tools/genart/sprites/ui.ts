import type { SpriteGrid } from '../grid';
import { PALETTE } from '../palette';

const P = PALETTE;

type Pal = Record<string, string | null>;

function grid(
  width: number,
  height: number,
  palette: Pal,
  paint: (set: (x: number, y: number, k: string) => void) => void,
): SpriteGrid {
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

/** 18×18 nine-slice panel — shutter-blue timber, top-left sun bevel. */
export const PANEL: SpriteGrid = grid(
  18,
  18,
  {
    b: P.uiPanel,
    r: P.uiRaised,
    s: P.uiRecess,
    i: P.ink,
    h: P.shutter,
  },
  (set) => {
    for (let y = 0; y < 18; y += 1) {
      for (let x = 0; x < 18; x += 1) {
        const edgeT = y < 6;
        const edgeB = y >= 12;
        const edgeL = x < 6;
        const edgeR = x >= 12;
        if (edgeT && edgeL) set(x, y, y === 0 || x === 0 ? 'i' : 'r');
        else if (edgeT && edgeR) set(x, y, y === 0 || x === 17 ? 'i' : 's');
        else if (edgeB && edgeL) set(x, y, y === 17 || x === 0 ? 'i' : 's');
        else if (edgeB && edgeR) set(x, y, y === 17 || x === 17 ? 'i' : 's');
        else if (edgeT) set(x, y, y === 0 ? 'i' : y === 1 ? 'h' : 'r');
        else if (edgeB) set(x, y, y === 17 ? 'i' : 's');
        else if (edgeL) set(x, y, x === 0 ? 'i' : 'r');
        else if (edgeR) set(x, y, x === 17 ? 'i' : 's');
        else set(x, y, 'b');
      }
    }
  },
);

/** Glyph patterns — 6 wide × 7 tall, `#` = ink. */
const GLYPHS: Record<string, string[]> = {
  ' ': ['......', '......', '......', '......', '......', '......', '......'],
  A: ['.##...', '#..#..', '#..#..', '####..', '#..#..', '#..#..', '......'],
  B: ['###...', '#..#..', '###...', '#..#..', '#..#..', '###...', '......'],
  C: ['.###..', '#...#.', '#.....', '#.....', '#...#.', '.###..', '......'],
  D: ['###...', '#..#..', '#..#..', '#..#..', '#..#..', '###...', '......'],
  E: ['####..', '#.....', '###...', '#.....', '#.....', '####..', '......'],
  F: ['####..', '#.....', '###...', '#.....', '#.....', '#.....', '......'],
  G: ['.###..', '#...#.', '#..##.', '#...#.', '#...#.', '.###..', '......'],
  H: ['#..#..', '#..#..', '####..', '#..#..', '#..#..', '#..#..', '......'],
  I: ['.##...', '..#...', '..#...', '..#...', '..#...', '.##...', '......'],
  J: ['..###.', '...#..', '...#..', '...#..', '#..#..', '.##...', '......'],
  K: ['#..#..', '#.#...', '##....', '#.#...', '#..#..', '#..#..', '......'],
  L: ['#.....', '#.....', '#.....', '#.....', '#.....', '####..', '......'],
  M: ['#...#.', '##.##.', '#.#.#.', '#...#.', '#...#.', '#...#.', '......'],
  N: ['#...#.', '##..#.', '#.#.#.', '#..##.', '#...#.', '#...#.', '......'],
  O: ['.###..', '#...#.', '#...#.', '#...#.', '#...#.', '.###..', '......'],
  P: ['###...', '#..#..', '###...', '#.....', '#.....', '#.....', '......'],
  Q: ['.###..', '#...#.', '#...#.', '#.#.#.', '#..#..', '.##.#.', '......'],
  R: ['###...', '#..#..', '###...', '#.#...', '#..#..', '#..#..', '......'],
  S: ['.####.', '#.....', '.###..', '....#.', '....#.', '####..', '......'],
  T: ['#####.', '..#...', '..#...', '..#...', '..#...', '..#...', '......'],
  U: ['#...#.', '#...#.', '#...#.', '#...#.', '#...#.', '.###..', '......'],
  V: ['#...#.', '#...#.', '#...#.', '#...#.', '.#.#..', '..#...', '......'],
  W: ['#...#.', '#...#.', '#.#.#.', '#.#.#.', '##.##.', '#...#.', '......'],
  X: ['#...#.', '.#.#..', '..#...', '.#.#..', '#...#.', '#...#.', '......'],
  Y: ['#...#.', '.#.#..', '..#...', '..#...', '..#...', '..#...', '......'],
  Z: ['#####.', '...#..', '..#...', '.#....', '#.....', '#####.', '......'],
  '0': ['.###..', '#..##.', '#.#.#.', '##..#.', '#...#.', '.###..', '......'],
  '1': ['..#...', '.##...', '..#...', '..#...', '..#...', '.###..', '......'],
  '2': ['.###..', '#...#.', '...#..', '..#...', '.#....', '#####.', '......'],
  '3': ['.###..', '#...#.', '..##..', '....#.', '#...#.', '.###..', '......'],
  '4': ['...#..', '..##..', '.#.#..', '#..#..', '#####.', '...#..', '......'],
  '5': ['#####.', '#.....', '####..', '....#.', '#...#.', '.###..', '......'],
  '6': ['.###..', '#.....', '####..', '#...#.', '#...#.', '.###..', '......'],
  '7': ['#####.', '....#.', '...#..', '..#...', '.#....', '.#....', '......'],
  '8': ['.###..', '#...#.', '.###..', '#...#.', '#...#.', '.###..', '......'],
  '9': ['.###..', '#...#.', '#...#.', '.####.', '....#.', '.###..', '......'],
  '.': ['......', '......', '......', '......', '..#...', '..#...', '......'],
  ',': ['......', '......', '......', '......', '..#...', '..#...', '.#....'],
  ':': ['......', '..#...', '..#...', '......', '..#...', '..#...', '......'],
  '/': ['....#.', '...#..', '..#...', '.#....', '#.....', '......', '......'],
  '-': ['......', '......', '####..', '......', '......', '......', '......'],
  '%': ['#..#..', '#..#..', '..#...', '.#....', '#..#..', '#..#..', '......'],
  '!': ['..#...', '..#...', '..#...', '..#...', '......', '..#...', '......'],
  '?': ['.###..', '#...#.', '...#..', '..#...', '......', '..#...', '......'],
  "'": ['..#...', '..#...', '.#....', '......', '......', '......', '......'],
  '+': ['......', '..#...', '..#...', '####..', '..#...', '..#...', '......'],
  '=': ['......', '####..', '......', '####..', '......', '......', '......'],
};

/** Order must match `src/ui/font.ts` FONT_GLYPHS (48 glyphs). */
export const FONT_GLYPH_ORDER =
  ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:/-%!?\'+=';

function glyphGrid(char: string): SpriteGrid {
  const pattern = GLYPHS[char];
  if (!pattern) throw new Error(`Missing glyph for ${char}`);
  const palette: Pal = { i: P.whitewash };
  return {
    size: [6, 7],
    palette: { '.': null, ...palette },
    rows: pattern,
  };
}

/** Build a two-row font strip (24 glyphs × 6px = 144 wide, 14 tall). */
export function makeFontStrip(): SpriteGrid {
  const chars = FONT_GLYPH_ORDER.split('');
  const rowWidth = 24 * 6;
  const width = rowWidth;
  const height = 14;
  const cells: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => '.'),
  );
  chars.forEach((char, index) => {
    const g = glyphGrid(char);
    const row = Math.floor(index / 24) * 7;
    const col = (index % 24) * 6;
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 6; x += 1) {
        const key = g.rows[y][x];
        if (key !== '.') cells[row + y][col + x] = 'i';
      }
    }
  });
  return {
    size: [width, height],
    palette: { '.': null, i: P.whitewash },
    rows: cells.map((row) => row.join('')),
  };
}

function icon16(
  palette: Pal,
  paint: (set: (x: number, y: number, k: string) => void) => void,
): SpriteGrid {
  return grid(16, 16, palette, paint);
}

export const ICON_WOOD = icon16({ b: P.terraDark, l: P.terraLight, i: P.ink, h: P.wheat }, (set) => {
  for (let y = 4; y <= 13; y += 1) {
    for (let x = 5; x <= 10; x += 1) {
      set(x, y, y < 6 ? 'l' : 'b');
    }
  }
  for (let x = 4; x <= 11; x += 1) set(x, 3, 'i');
  set(7, 2, 'h');
  set(8, 2, 'h');
});

export const ICON_STONE = icon16( { m: P.stoneMid, l: P.stoneLight, d: P.stoneShadow, i: P.ink }, (set) => {
  for (let y = 5; y <= 12; y += 1) {
    for (let x = 4; x <= 11; x += 1) {
      const edge = y === 5 || y === 12 || x === 4 || x === 11;
      set(x, y, edge ? 'i' : x < 7 ? 'l' : 'm');
    }
  }
  set(5, 6, 'd');
  set(9, 9, 'd');
});

export const ICON_GRAIN = icon16( { s: P.wheat, d: P.terraDark, g: P.vegLight, i: P.ink }, (set) => {
  for (let y = 8; y <= 14; y += 1) set(7, y, 'd');
  set(6, 7, 'd');
  set(8, 7, 'd');
  for (let y = 2; y <= 6; y += 1) {
    set(7, y, 's');
    if (y > 3) {
      set(5, y, 'g');
      set(9, y, 'g');
    }
  }
  set(4, 5, 'g');
  set(10, 5, 'g');
});

export const ICON_FLOUR = icon16( { b: P.stonePale, s: P.sandMid, i: P.ink, d: P.stoneShadow }, (set) => {
  for (let y = 6; y <= 13; y += 1) {
    for (let x = 5; x <= 10; x += 1) {
      set(x, y, x === 5 || x === 10 || y === 13 ? 'i' : 'b');
    }
  }
  for (let y = 7; y <= 10; y += 1) {
    for (let x = 6; x <= 9; x += 1) set(x, y, 's');
  }
  set(6, 5, 'd');
  set(9, 5, 'd');
});

export const ICON_FOOD = icon16( { c: P.terraLight, d: P.terraDark, i: P.ink, w: P.whitewash }, (set) => {
  for (let y = 9; y <= 12; y += 1) {
    for (let x = 4; x <= 11; x += 1) set(x, y, 'd');
  }
  for (let y = 6; y <= 8; y += 1) {
    for (let x = 5; x <= 10; x += 1) set(x, y, y === 6 ? 'c' : 'd');
  }
  set(6, 5, 'w');
  set(9, 5, 'w');
});

export const ICON_GOLD = icon16( { g: P.wheat, d: P.terraDark, l: P.sandPale, i: P.ink }, (set) => {
  for (let y = 6; y <= 11; y += 1) {
    for (let x = 5; x <= 10; x += 1) {
      const edge = y === 6 || y === 11 || x === 5 || x === 10;
      set(x, y, edge ? 'i' : 'g');
    }
  }
  set(7, 8, 'l');
  set(8, 8, 'l');
});

export const ICON_SPRING = icon16( { p: P.vegPale, g: P.vegLight, s: P.shutter, i: P.ink }, (set) => {
  set(7, 3, 's');
  set(6, 4, 'p');
  set(8, 4, 'p');
  set(5, 5, 'g');
  set(9, 5, 'g');
  set(7, 5, 'p');
  set(6, 6, 'g');
  set(8, 6, 'g');
  set(7, 7, 'i');
  set(7, 8, 'i');
  set(6, 9, 'g');
  set(8, 9, 'g');
});

export const ICON_SUMMER = icon16( { y: P.wheat, o: P.terraLight, i: P.ink }, (set) => {
  for (let y = 4; y <= 10; y += 1) {
    for (let x = 4; x <= 11; x += 1) {
      const dx = x - 7.5;
      const dy = y - 7;
      if (dx * dx + dy * dy <= 12) set(x, y, 'y');
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(angle) * 6);
    const y = Math.round(7 + Math.sin(angle) * 6);
    set(x, y, 'o');
  }
});

export const ICON_AUTUMN = icon16( { r: P.terraMid, o: P.terraLight, i: P.ink, b: P.terraDark }, (set) => {
  set(7, 4, 'b');
  set(6, 5, 'o');
  set(8, 5, 'r');
  set(5, 6, 'r');
  set(9, 6, 'o');
  set(6, 7, 'r');
  set(8, 7, 'o');
  set(7, 8, 'i');
});

export const ICON_WINTER = icon16( { w: P.whitewash, b: P.shutter, i: P.ink }, (set) => {
  set(7, 3, 'w');
  set(6, 4, 'w');
  set(8, 4, 'w');
  set(5, 5, 'w');
  set(9, 5, 'w');
  set(7, 5, 'b');
  set(4, 6, 'w');
  set(10, 6, 'w');
  set(7, 6, 'w');
  set(6, 7, 'w');
  set(8, 7, 'w');
  set(7, 8, 'i');
  set(5, 9, 'w');
  set(9, 9, 'w');
});

export const ICON_PAUSE = icon16( { f: P.whitewash, i: P.ink }, (set) => {
  for (let y = 5; y <= 10; y += 1) {
    set(6, y, 'f');
    set(9, y, 'f');
  }
  for (let y = 4; y <= 11; y += 1) {
    set(5, y, 'i');
    set(10, y, 'i');
  }
});

function speedIcon(chevrons: number): SpriteGrid {
  return icon16({ c: P.whitewash, i: P.ink }, (set) => {
    for (let n = 0; n < chevrons; n += 1) {
      const ox = 4 + n * 3;
      for (let i = 0; i < 5; i += 1) {
        set(ox + i, 5 + i, 'c');
        set(ox + i, 10 - i, 'c');
      }
    }
  });
}

export const ICON_SPEED1 = speedIcon(1);
export const ICON_SPEED2 = speedIcon(2);
export const ICON_SPEED3 = speedIcon(3);

export const ICON_LOCK = grid(8, 8, { b: P.wheat, s: P.stoneMid, i: P.ink }, (set) => {
  set(2, 1, 'i');
  set(5, 1, 'i');
  set(1, 2, 'i');
  set(6, 2, 'i');
  for (let x = 2; x <= 5; x += 1) set(x, 2, 's');
  for (let y = 3; y <= 6; y += 1) {
    for (let x = 1; x <= 6; x += 1) {
      set(x, y, y === 3 || y === 6 || x === 1 || x === 6 ? 'i' : 'b');
    }
  }
  set(3, 5, 'i');
});

export const BAR_NOTCH = grid(4, 6, { f: P.vegLight, i: P.ink, r: P.vegMid }, (set) => {
  for (let y = 1; y <= 4; y += 1) {
    for (let x = 1; x <= 2; x += 1) set(x, y, 'f');
  }
  set(0, 0, 'i');
  set(3, 0, 'i');
  set(0, 5, 'i');
  set(3, 5, 'i');
  set(1, 0, 'r');
  set(2, 0, 'r');
});

export const BAR_NOTCH_EMPTY = grid(4, 6, { e: P.uiRecess, i: P.ink }, (set) => {
  for (let y = 1; y <= 4; y += 1) {
    for (let x = 1; x <= 2; x += 1) set(x, y, 'e');
  }
  for (let x = 0; x <= 3; x += 1) {
    set(x, 0, 'i');
    set(x, 5, 'i');
  }
  for (let y = 0; y <= 5; y += 1) {
    set(0, y, 'i');
    set(3, y, 'i');
  }
});

function bracketCorner(mirrorX: boolean, mirrorY: boolean): SpriteGrid {
  return grid(8, 8, { b: P.wheat, i: P.ink }, (set) => {
    const plot = (lx: number, ly: number, k: string) => {
      const x = mirrorX ? 7 - lx : lx;
      const y = mirrorY ? 7 - ly : ly;
      set(x, y, k);
    };
    for (let i = 0; i < 4; i += 1) {
      plot(0, i, 'b');
      plot(i, 0, 'b');
    }
    plot(0, 0, 'i');
    plot(1, 0, 'i');
    plot(0, 1, 'i');
  });
}

export const BRACKET_TL = bracketCorner(false, false);
export const BRACKET_TR = bracketCorner(true, false);
export const BRACKET_BL = bracketCorner(false, true);
export const BRACKET_BR = bracketCorner(true, true);

export const UI_SPRITES: Record<string, SpriteGrid> = {
  'ui.panel': PANEL,
  'font.strip': makeFontStrip(),
  'ui.icon.wood': ICON_WOOD,
  'ui.icon.stone': ICON_STONE,
  'ui.icon.grain': ICON_GRAIN,
  'ui.icon.flour': ICON_FLOUR,
  'ui.icon.food': ICON_FOOD,
  'ui.icon.gold': ICON_GOLD,
  'ui.icon.spring': ICON_SPRING,
  'ui.icon.summer': ICON_SUMMER,
  'ui.icon.autumn': ICON_AUTUMN,
  'ui.icon.winter': ICON_WINTER,
  'ui.icon.pause': ICON_PAUSE,
  'ui.icon.speed1': ICON_SPEED1,
  'ui.icon.speed2': ICON_SPEED2,
  'ui.icon.speed3': ICON_SPEED3,
  'ui.icon.lock': ICON_LOCK,
  'ui.bar.notch': BAR_NOTCH,
  'ui.bar.notch.empty': BAR_NOTCH_EMPTY,
  'ui.bracket.tl': BRACKET_TL,
  'ui.bracket.tr': BRACKET_TR,
  'ui.bracket.bl': BRACKET_BL,
  'ui.bracket.br': BRACKET_BR,
};
