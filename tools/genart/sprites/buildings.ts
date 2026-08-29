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

/** 1×1 hut — whitewash, terracotta roof. 16×32, anchorY 16. */
export const HUT: SpriteGrid = grid(16, 32, {
  t: P.terraMid,
  d: P.terraDark,
  l: P.terraLight,
  w: P.whitewash,
  s: P.shutter,
  i: P.ink,
  c: P.sandShadow,
  g: P.stoneLight,
}, (set) => {
  // Roof triangle in headroom (y 2..15)
  for (let y = 2; y <= 15; y += 1) {
    const half = y - 1;
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      set(x, y, y === 2 || x === 8 - half || x === 7 + half ? 'd' : y < 6 ? 'l' : 't');
    }
  }
  // Walls on footprint (y 16..29)
  for (let y = 16; y <= 29; y += 1) {
    for (let x = 2; x <= 13; x += 1) {
      if (y === 16 || y === 29 || x === 2 || x === 13) set(x, y, 'i');
      else set(x, y, 'w');
    }
  }
  // Shutter window
  for (let y = 18; y <= 22; y += 1) {
    for (let x = 4; x <= 7; x += 1) set(x, y, 's');
  }
  set(5, 20, 'i');
  set(6, 20, 'i');
  // Door
  for (let y = 23; y <= 28; y += 1) {
    set(10, y, 'g');
    set(11, y, 'g');
  }
  set(10, 25, 'i');
  // Contact shadow
  for (let x = 1; x <= 14; x += 1) {
    set(x, 30, 'c');
    set(x, 31, 'c');
  }
});

/** Farm shed at plot origin. 16×24, anchorY 8. */
export const FARM: SpriteGrid = grid(16, 24, {
  t: P.terraMid,
  d: P.terraDark,
  w: P.stonePale,
  m: P.stoneMid,
  i: P.ink,
  c: P.sandShadow,
  v: P.vegMid,
}, (set) => {
  for (let y = 2; y <= 7; y += 1) {
    const half = y;
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      set(x, y, y === 2 || x === 8 - half || x === 7 + half ? 'd' : 't');
    }
  }
  for (let y = 8; y <= 18; y += 1) {
    for (let x = 3; x <= 12; x += 1) {
      if (y === 8 || y === 18 || x === 3 || x === 12) set(x, y, 'i');
      else if (y >= 12 && y <= 16 && x >= 7 && x <= 9) set(x, y, 'm');
      else set(x, y, 'w');
    }
  }
  for (let x = 2; x <= 13; x += 1) {
    set(x, 19, 'c');
    set(x, 20, 'c');
  }
  set(4, 21, 'v');
  set(5, 21, 'v');
  set(10, 21, 'v');
  set(11, 21, 'v');
});

/** Tilled 3×3 farm field. 48×48, anchorY 0. */
export const FARM_FIELD: SpriteGrid = grid(48, 48, {
  a: P.sandShadow,
  b: P.sandMid,
  c: P.sandLight,
  f: P.vegDark,
  i: P.ink,
}, (set) => {
  for (let y = 0; y < 48; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      const edge = x === 0 || y === 0 || x === 47 || y === 47;
      const post = (x === 0 || x === 47) && y % 8 === 0;
      if (post) set(x, y, 'i');
      else if (edge) set(x, y, 'f');
      else if ((x + y) % 3 === 0) set(x, y, 'a');
      else if ((x * 2 + y) % 5 === 0) set(x, y, 'c');
      else set(x, y, 'b');
    }
  }
});

/** 2×2 granary. 32×48, anchorY 16. */
export const GRANARY: SpriteGrid = grid(32, 48, {
  t: P.terraMid,
  d: P.terraDark,
  l: P.terraLight,
  w: P.whitewash,
  s: P.stoneMid,
  p: P.stonePale,
  i: P.ink,
  c: P.sandShadow,
  u: P.shutter,
}, (set) => {
  // Roof in headroom
  for (let y = 4; y <= 15; y += 1) {
    const inset = 15 - y;
    for (let x = 4 + inset; x <= 27 - inset; x += 1) {
      set(x, y, y === 4 || x === 4 + inset || x === 27 - inset ? 'd' : y < 8 ? 'l' : 't');
    }
  }
  // Walls on footprint
  for (let y = 16; y <= 42; y += 1) {
    for (let x = 4; x <= 27; x += 1) {
      if (y === 16 || y === 42 || x === 4 || x === 27) set(x, y, 'i');
      else set(x, y, 'w');
    }
  }
  // Windows
  for (let y = 20; y <= 24; y += 1) {
    for (let x = 8; x <= 11; x += 1) set(x, y, 'u');
    for (let x = 20; x <= 23; x += 1) set(x, y, 'u');
  }
  // Stone vent band
  for (let y = 28; y <= 36; y += 1) {
    for (let x = 10; x <= 21; x += 1) {
      set(x, y, y === 28 || y === 36 || x === 10 || x === 21 ? 's' : 'p');
    }
  }
  for (let y = 31; y <= 33; y += 1) {
    set(14, y, 'i');
    set(15, y, 'i');
    set(16, y, 'i');
  }
  for (let x = 3; x <= 28; x += 1) {
    set(x, 43, 'c');
    set(x, 44, 'c');
  }
});

function millFrame(sailOffset: number): SpriteGrid {
  return grid(32, 64, {
    t: P.terraMid,
    d: P.terraDark,
    l: P.terraLight,
    w: P.whitewash,
    u: P.shutter,
    i: P.ink,
    c: P.sandShadow,
  }, (set) => {
    const cx = 15;
    const cy = 22;
    // Sails
    const arms = [
      { ax: 0, ay: -1 },
      { ax: 1, ay: 0 },
      { ax: 0, ay: 1 },
      { ax: -1, ay: 0 },
    ];
    for (let a = 0; a < 4; a += 1) {
      const arm = arms[(a + sailOffset) % 4];
      const len = a % 2 === 0 ? 10 : 8;
      for (let t = 2; t <= len; t += 1) {
        const x = cx + arm.ax * t;
        const y = cy + arm.ay * t;
        set(x, y, t < 4 ? 'd' : 't');
        if (t >= 4) {
          if (arm.ax === 0) {
            set(x - 1, y, 'l');
            set(x + 1, y, 'l');
          } else {
            set(x, y - 1, 'l');
            set(x, y + 1, 'l');
          }
        }
      }
    }
    // Hub
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) set(cx + dx, cy + dy, 'i');
    }
    // Tower on footprint (anchorY 32 → footprint y 32..63, but tower reads better starting mid)
    for (let y = 28; y <= 55; y += 1) {
      for (let x = 10; x <= 21; x += 1) {
        if (y === 28 || y === 55 || x === 10 || x === 21) set(x, y, 'i');
        else if (y >= 38 && y <= 44 && x >= 14 && x <= 17) set(x, y, 'u');
        else set(x, y, 'w');
      }
    }
    for (let x = 9; x <= 22; x += 1) {
      set(x, 56, 'c');
      set(x, 57, 'c');
    }
  });
}

export const MILL_FRAMES: SpriteGrid[] = [0, 1, 2, 3].map(millFrame);

function bakeryFrame(_smoke: number): SpriteGrid {
  return grid(32, 48, {
    t: P.terraMid,
    d: P.terraDark,
    w: P.whitewash,
    s: P.stoneMid,
    u: P.shutter,
    i: P.ink,
    c: P.sandShadow,
  }, (set) => {
    // Chimney — smoke is a separate vfx.smoke overlay in the renderer.
    for (let y = 8; y <= 18; y += 1) {
      for (let x = 20; x <= 23; x += 1) {
        set(x, y, x === 20 || x === 23 || y === 8 ? 'i' : 's');
      }
    }
    // Roof
    for (let y = 12; y <= 18; y += 1) {
      const inset = 18 - y;
      for (let x = 8 + inset; x <= 23 - inset; x += 1) {
        set(x, y, y === 12 ? 'd' : 't');
      }
    }
    // Walls
    for (let y = 19; y <= 38; y += 1) {
      for (let x = 8; x <= 23; x += 1) {
        if (y === 19 || y === 38 || x === 8 || x === 23) set(x, y, 'i');
        else if (y >= 28 && y <= 34 && x >= 13 && x <= 18) set(x, y, 'u');
        else set(x, y, 'w');
      }
    }
    for (let x = 7; x <= 24; x += 1) {
      set(x, 39, 'c');
      set(x, 40, 'c');
    }
  });
}

export const BAKERY: SpriteGrid = bakeryFrame(0);

/** 1×1 well — stone drum, timber frame, shingled cap. 16×32, anchorY 16. */
export const WELL: SpriteGrid = grid(16, 32, {
  m: P.stoneMid,
  l: P.stoneLight,
  p: P.stonePale,
  s: P.stoneShadow,
  t: P.terraMid,
  d: P.terraDark,
  a: P.seaMid,
  i: P.ink,
}, (set) => {
  // Shingled cap in the headroom (y 3..9).
  for (let y = 3; y <= 9; y += 1) {
    const half = y - 1;
    for (let x = 8 - half; x <= 7 + half; x += 1) {
      set(x, y, y === 3 || x === 8 - half || x === 7 + half ? 'd' : 't');
    }
  }
  // Posts down to the drum lip.
  for (let y = 10; y <= 21; y += 1) {
    set(3, y, 's');
    set(12, y, 's');
  }
  // Winch bar and bucket rope.
  for (let x = 4; x <= 11; x += 1) set(x, 11, 'i');
  for (let y = 12; y <= 15; y += 1) set(8, y, 'i');
  for (let y = 16; y <= 18; y += 1) {
    for (let x = 6; x <= 9; x += 1) set(x, y, y === 16 ? 's' : 'm');
  }
  // Stone drum on the footprint (y 22..29) with water inside the lip.
  for (let y = 22; y <= 29; y += 1) {
    for (let x = 2; x <= 13; x += 1) {
      if (y === 22) set(x, y, 'p');
      else if (x === 2 || x === 13 || y === 29) set(x, y, 's');
      else set(x, y, (x + y) % 4 === 0 ? 'l' : 'm');
    }
  }
  for (let x = 4; x <= 11; x += 1) set(x, 23, 'a');
  // Contact shadow.
  for (let x = 3; x <= 12; x += 1) set(x, 30, 'i');
});

/** Palette shared by the timber decor pieces. */
const TIMBER: Pal = {
  t: P.terraMid,
  d: P.terraDark,
  m: P.stoneMid,
  g: P.stoneLight,
  p: P.stonePale,
  i: P.ink,
  c: P.sandShadow,
};

/**
 * 1×1 fence — two rails and a pair of posts. 16×24, anchorY 8.
 * The rails run the full sprite width so abutting fence tiles read as one run.
 */
export const FENCE: SpriteGrid = grid(16, 24, TIMBER, (set) => {
  for (const railY of [14, 19]) {
    for (let x = 0; x <= 15; x += 1) {
      set(x, railY, 'd');
      set(x, railY + 1, 't');
    }
  }
  for (const postX of [2, 12]) {
    for (let y = 11; y <= 21; y += 1) {
      set(postX, y, 'd');
      set(postX + 1, y, 'm');
    }
  }
  for (let x = 1; x <= 14; x += 1) set(x, 22, 'c');
});

/** 1×1 gate — posts, lintel, and a braced swing panel. 16×24, anchorY 8. */
export const GATE: SpriteGrid = grid(16, 24, TIMBER, (set) => {
  // Uprights and the lintel spanning them.
  for (const postX of [1, 13]) {
    for (let y = 6; y <= 21; y += 1) {
      set(postX, y, 'd');
      set(postX + 1, y, 'm');
    }
  }
  for (let x = 1; x <= 14; x += 1) {
    set(x, 6, 'd');
    set(x, 7, 't');
  }
  // Panel with a diagonal brace.
  for (let y = 11; y <= 20; y += 1) {
    for (let x = 4; x <= 11; x += 1) {
      set(x, y, y === 11 || y === 20 ? 'd' : 'g');
    }
  }
  for (let step = 0; step <= 8; step += 1) {
    set(4 + step, 20 - step, 'd');
  }
  set(10, 15, 'i');
  for (let x = 0; x <= 15; x += 1) set(x, 22, 'c');
});

/** 1×1 signpost — a lettered board on a leaning post. 16×24, anchorY 8. */
export const SIGNPOST: SpriteGrid = grid(16, 24, TIMBER, (set) => {
  for (let y = 12; y <= 21; y += 1) {
    set(7, y, 'd');
    set(8, y, 'm');
  }
  // Board.
  for (let y = 7; y <= 13; y += 1) {
    for (let x = 2; x <= 13; x += 1) {
      set(x, y, y === 7 || y === 13 || x === 2 || x === 13 ? 'd' : 'p');
    }
  }
  // Two lines of illegible lettering — reads as text at 2× without spelling anything.
  for (let x = 4; x <= 11; x += 1) set(x, 9, 'i');
  for (let x = 4; x <= 8; x += 1) set(x, 11, 'i');
  for (let x = 5; x <= 10; x += 1) set(x, 22, 'c');
});

/**
 * 2×2 storehouse — plank walls, gabled roof, wide cart doors. 32×48, anchorY 16.
 * The generic wood/stone counterpart to the grain-only granary.
 */
export const STOREHOUSE: SpriteGrid = grid(32, 48, {
  ...TIMBER,
  s: P.stoneShadow,
  w: P.whitewash,
}, (set) => {
  // Gable that widens to the full sprite at the eaves.
  for (let y = 6; y <= 21; y += 1) {
    const half = 2 + (y - 6);
    for (let x = 16 - half; x <= 15 + half; x += 1) {
      set(x, y, y === 6 || x === 16 - half || x === 15 + half ? 'd' : y < 12 ? 't' : 'd');
    }
  }
  // Plank walls on the footprint.
  for (let y = 22; y <= 44; y += 1) {
    for (let x = 2; x <= 29; x += 1) {
      if (y === 22 || y === 44 || x === 2 || x === 29) set(x, y, 'i');
      else set(x, y, x % 5 === 0 ? 'm' : 'p');
    }
  }
  // Cart doors, split down the middle.
  for (let y = 30; y <= 43; y += 1) {
    for (let x = 11; x <= 20; x += 1) {
      set(x, y, y === 30 || x === 11 || x === 20 ? 'i' : 'g');
    }
  }
  for (let y = 32; y <= 43; y += 1) set(15, y, 's');
  set(13, 37, 'i');
  set(18, 37, 'i');
  // Stacked timber under the eaves — says "this is where the wood goes".
  for (let y = 25; y <= 28; y += 1) {
    for (let x = 4; x <= 9; x += 1) set(x, y, y % 2 === 0 ? 'd' : 't');
  }
  for (let y = 25; y <= 28; y += 1) {
    for (let x = 22; x <= 27; x += 1) set(x, y, y % 2 === 0 ? 's' : 'w');
  }
  for (let x = 1; x <= 30; x += 1) {
    set(x, 45, 'c');
    set(x, 46, 'c');
  }
});

function scaffold(tiles: number): SpriteGrid {
  const px = tiles * 16;
  const height = px + 8;
  return grid(px, height, {
    i: P.ink,
    m: P.stoneMid,
    c: P.sandShadow,
  }, (set) => {
    for (let y = 0; y < height - 8; y += 1) {
      for (let x = 0; x < px; x += 1) {
        const edge = x === 0 || x === px - 1 || y === height - 9;
        const cross = (x + y) % 6 === 0;
        const post = x % 16 === 0 || x === px - 1;
        if (post || edge) set(x, y, 'i');
        else if (cross) set(x, y, 'm');
      }
    }
    for (let y = height - 8; y < height; y += 1) {
      for (let x = 2; x < px - 2; x += 1) set(x, y, 'c');
    }
  });
}

export const SCAFFOLD_1 = scaffold(1);
export const SCAFFOLD_2 = scaffold(2);
export const SCAFFOLD_3 = scaffold(3);

export interface BuildingSprite {
  grid: SpriteGrid;
  anchorY: number;
  frames?: SpriteGrid[];
}

export const BUILDING_SPRITES: Record<string, BuildingSprite> = {
  hut: { grid: HUT, anchorY: 16 },
  farm: { grid: FARM, anchorY: 8 },
  'farm.field': { grid: FARM_FIELD, anchorY: 0 },
  granary: { grid: GRANARY, anchorY: 16 },
  mill: { grid: MILL_FRAMES[0], anchorY: 32, frames: MILL_FRAMES },
  bakery: { grid: BAKERY, anchorY: 16 },
  well: { grid: WELL, anchorY: 16 },
  fence: { grid: FENCE, anchorY: 8 },
  gate: { grid: GATE, anchorY: 8 },
  signpost: { grid: SIGNPOST, anchorY: 8 },
  storehouse: { grid: STOREHOUSE, anchorY: 16 },
  'scaffold.1': { grid: SCAFFOLD_1, anchorY: 8 },
  'scaffold.2': { grid: SCAFFOLD_2, anchorY: 8 },
  'scaffold.3': { grid: SCAFFOLD_3, anchorY: 8 },
};
