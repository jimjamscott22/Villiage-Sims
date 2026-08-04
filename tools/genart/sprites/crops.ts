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
};
