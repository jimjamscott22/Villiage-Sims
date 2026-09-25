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

function wheatStage(stage: number, sway = 0): SpriteGrid {
  return grid(16, 16, {
    s: P.sandMid,
    a: P.sandShadow,
    v: P.vegDark,
    m: P.vegMid,
    l: P.vegLight,
    w: P.wheat,
    i: P.ink,
  }, (set) => {
    // Soil pad
    for (let y = 13; y <= 15; y += 1) {
      for (let x = 2; x <= 13; x += 1) set(x, y, (x + y) % 2 === 0 ? 's' : 'a');
    }
    if (stage === 0) {
      // Sprouts
      for (const x of [4, 8, 12]) {
        set(x, 12, 'v');
        set(x, 11, 'm');
      }
      return;
    }
    const h = 4 + stage * 2;
    const stalks = [3, 6, 9, 12];
    for (const baseX of stalks) {
      const lean = sway === 0 ? 0 : baseX < 8 ? 1 : -1;
      for (let t = 0; t < h; t += 1) {
        const x = baseX + (t > h - 3 ? lean : 0);
        const y = 12 - t;
        set(x, y, t < 2 ? 'v' : 'm');
      }
      if (stage >= 2) {
        const tipY = 12 - h;
        const tipX = baseX + lean;
        set(tipX, tipY, stage === 3 ? 'w' : 'l');
        set(tipX - 1, tipY + 1, stage === 3 ? 'w' : 'l');
        set(tipX + 1, tipY + 1, stage === 3 ? 'w' : 'l');
      }
      if (stage === 3) set(baseX + lean, 12 - h - 1, 'i');
    }
  });
}

export const WHEAT_STAGES: SpriteGrid[] = [
  wheatStage(0),
  wheatStage(1),
  wheatStage(2),
  wheatStage(3, 0),
];

export const WHEAT_STAGE_3_SWAY: SpriteGrid[] = [wheatStage(3, 0), wheatStage(3, 1)];

/** Shared seedling tuft used by every crop's stage 0 — young sprouts look alike. */
function sproutStage(): SpriteGrid {
  return grid(16, 16, {
    s: P.sandMid,
    a: P.sandShadow,
    v: P.vegDark,
    l: P.vegLight,
  }, (set) => {
    for (let y = 13; y <= 15; y += 1) {
      for (let x = 2; x <= 13; x += 1) set(x, y, (x + y) % 2 === 0 ? 's' : 'a');
    }
    for (const x of [5, 8, 11]) {
      set(x, 12, 'v');
      set(x, 11, 'l');
    }
  });
}

function soilPad(set: (x: number, y: number, k: string) => void): void {
  for (let y = 13; y <= 15; y += 1) {
    for (let x = 2; x <= 13; x += 1) set(x, y, (x + y) % 2 === 0 ? 's' : 'a');
  }
}

function strawberryStage(stage: number, sway = 0): SpriteGrid {
  if (stage === 0) return sproutStage();
  return grid(16, 16, {
    s: P.sandMid,
    a: P.sandShadow,
    v: P.vegDark,
    m: P.vegMid,
    l: P.vegLight,
    r: P.terraDark,
    t: P.terraLight,
    i: P.ink,
  }, (set) => {
    soilPad(set);
    // Rounded bush, one row taller once ripe.
    const rows: Array<[number, number[]]> = [
      [12, [4, 5, 6, 7, 8, 9, 10, 11]],
      [11, [5, 6, 7, 8, 9, 10]],
      [10, [6, 7, 8, 9]],
    ];
    if (stage >= 2) rows.push([9, [7, 8]]);
    for (const [y, xs] of rows) {
      for (const x of xs) set(x, y, (x + y) % 2 === 0 ? 'v' : 'm');
    }
    if (stage >= 2) {
      const berries: Array<[number, number]> = [
        [5, 12],
        [10 + (sway ? 1 : 0), 11],
        [7, 9],
      ];
      for (const [x, y] of berries) {
        set(x, y, 'r');
        set(x + 1, y, 't');
        set(x, y - 1, 'i');
      }
    } else {
      // Unripe flush of pale leaf tips.
      for (const x of [6, 9]) set(x, 10, 'l');
    }
  });
}

function peasStage(stage: number, sway = 0): SpriteGrid {
  if (stage === 0) return sproutStage();
  return grid(16, 16, {
    s: P.sandMid,
    a: P.sandShadow,
    v: P.vegDark,
    m: P.vegMid,
    l: P.vegLight,
    p: P.vegPale,
    i: P.ink,
  }, (set) => {
    soilPad(set);
    const h = 4 + stage * 2;
    const stalkX = 8;
    for (let t = 0; t < h; t += 1) {
      const lean = sway !== 0 && t > h - 3 ? sway : 0;
      set(stalkX + lean, 12 - t, 'v');
      if (t % 2 === 1) {
        set(stalkX - 2 + lean, 12 - t, 'm');
        set(stalkX + 2 + lean, 12 - t, 'm');
      }
    }
    if (stage >= 2) {
      // Hanging pods off the two middle branch nodes.
      const podRows = [5, 3];
      for (const t of podRows) {
        const x = stalkX - 2;
        const y = 12 - t + 1;
        set(x, y, 'p');
        set(x, y + 1, 'p');
        set(x, y + 2, 'i');
      }
    } else {
      set(stalkX, 12 - h, 'l');
    }
  });
}

function carrotStage(stage: number, sway = 0): SpriteGrid {
  if (stage === 0) return sproutStage();
  return grid(16, 16, {
    s: P.sandMid,
    a: P.sandShadow,
    v: P.vegDark,
    m: P.vegMid,
    l: P.vegLight,
    o: P.terraMid,
    t: P.terraLight,
    i: P.ink,
  }, (set) => {
    soilPad(set);
    // Feathery fern-like top: thin blades fanning out from the crown.
    const crownX = 7;
    const crownY = 12;
    const bladeCount = 3 + stage;
    const spread = 2 + stage;
    for (let n = 0; n < bladeCount; n += 1) {
      const dx = Math.round((n - (bladeCount - 1) / 2) * (spread / bladeCount) * 2);
      const lean = sway !== 0 ? sway : 0;
      const h = 4 + stage + (n % 2 === 0 ? 1 : 0);
      for (let t = 0; t < h; t += 1) {
        const x = crownX + dx + (t > h - 2 ? lean : 0);
        const y = crownY - t;
        set(x, y, t < 2 ? 'v' : 'm');
      }
      if (stage >= 2) set(crownX + dx, crownY - h, 'l');
    }
    if (stage >= 3) {
      // Ripe root shoulder peeking out of the soil at harvest.
      set(crownX - 1, crownY, 'o');
      set(crownX, crownY, 'o');
      set(crownX + 1, crownY, 't');
      set(crownX, crownY + 1, 'i');
    }
  });
}

export const STRAWBERRY_STAGES: SpriteGrid[] = [
  strawberryStage(0),
  strawberryStage(1),
  strawberryStage(2, 0),
];
export const STRAWBERRY_STAGE_2_SWAY: SpriteGrid[] = [
  strawberryStage(2, 0),
  strawberryStage(2, 1),
];

export const PEAS_STAGES: SpriteGrid[] = [peasStage(0), peasStage(1), peasStage(2, 0)];
export const PEAS_STAGE_2_SWAY: SpriteGrid[] = [peasStage(2, 0), peasStage(2, 1)];

export const CARROT_STAGES: SpriteGrid[] = [
  carrotStage(0),
  carrotStage(1),
  carrotStage(2),
  carrotStage(3, 0),
];
export const CARROT_STAGE_3_SWAY: SpriteGrid[] = [carrotStage(3, 0), carrotStage(3, 1)];

export interface CropSprite {
  grid: SpriteGrid;
  anchorY: number;
  frames?: SpriteGrid[];
}

export const CROP_SPRITES: Record<string, CropSprite> = {
  'wheat.0': { grid: WHEAT_STAGES[0], anchorY: 0 },
  'wheat.1': { grid: WHEAT_STAGES[1], anchorY: 0 },
  'wheat.2': { grid: WHEAT_STAGES[2], anchorY: 0 },
  'wheat.3': { grid: WHEAT_STAGE_3_SWAY[0], anchorY: 0, frames: WHEAT_STAGE_3_SWAY },
  wheat: { grid: WHEAT_STAGES[0], anchorY: 0 }, // catalog fallback id

  'strawberry.0': { grid: STRAWBERRY_STAGES[0], anchorY: 0 },
  'strawberry.1': { grid: STRAWBERRY_STAGES[1], anchorY: 0 },
  'strawberry.2': {
    grid: STRAWBERRY_STAGE_2_SWAY[0],
    anchorY: 0,
    frames: STRAWBERRY_STAGE_2_SWAY,
  },
  strawberry: { grid: STRAWBERRY_STAGES[0], anchorY: 0 },

  'peas.0': { grid: PEAS_STAGES[0], anchorY: 0 },
  'peas.1': { grid: PEAS_STAGES[1], anchorY: 0 },
  'peas.2': { grid: PEAS_STAGE_2_SWAY[0], anchorY: 0, frames: PEAS_STAGE_2_SWAY },
  peas: { grid: PEAS_STAGES[0], anchorY: 0 },

  'carrot.0': { grid: CARROT_STAGES[0], anchorY: 0 },
  'carrot.1': { grid: CARROT_STAGES[1], anchorY: 0 },
  'carrot.2': { grid: CARROT_STAGES[2], anchorY: 0 },
  'carrot.3': { grid: CARROT_STAGE_3_SWAY[0], anchorY: 0, frames: CARROT_STAGE_3_SWAY },
  carrot: { grid: CARROT_STAGES[0], anchorY: 0 },
};
