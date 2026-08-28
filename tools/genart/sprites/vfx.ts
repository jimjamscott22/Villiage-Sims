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

/** Chimney smoke puff — 16×24, anchorY 0 (emission at bottom). */
function smokeFrame(phase: number): SpriteGrid {
  return grid(16, 24, {
    p: P.stonePale,
    w: P.whitewash,
    m: P.stoneMid,
  }, (set) => {
    const lift = phase * 3;
    const spread = 1 + phase;
    const baseY = 20 - lift;
    for (let y = baseY - spread; y <= baseY + spread; y += 1) {
      for (let x = 7 - spread; x <= 8 + spread; x += 1) {
        const edge = x === 7 - spread || x === 8 + spread || y === baseY - spread;
        if (phase === 2 && edge) continue;
        set(x, y, phase === 0 ? 'm' : edge ? 'p' : 'w');
      }
    }
    if (phase >= 1) {
      set(7, baseY - spread - 1, 'p');
      set(8, baseY - spread - 1, 'p');
    }
    if (phase === 2) {
      set(7, baseY - spread - 2, 'w');
      set(9, baseY - spread - 1, 'w');
    }
  });
}

export const SMOKE_FRAMES: SpriteGrid[] = [0, 1, 2].map(smokeFrame);

/** Mill flour dust — 16×16, anchorY 8 (ground contact). */
function dustFrame(phase: number): SpriteGrid {
  return grid(16, 16, {
    p: P.sandPale,
    l: P.sandLight,
    m: P.stonePale,
    s: P.sandMid,
  }, (set) => {
    const drift = phase * 2;
    for (let y = 9; y <= 11; y += 1) {
      for (let x = 4 + drift; x <= 10 + drift; x += 1) {
        set(x, y, y === 11 ? 's' : x <= 6 + drift ? 'l' : 'p');
      }
    }
    if (phase >= 1) {
      for (let x = 8 + drift; x <= 13 + drift; x += 1) set(x, 8, 'm');
    }
    if (phase === 2) {
      set(11 + drift, 7, 'p');
      set(12 + drift, 7, 'l');
    }
  });
}

export const DUST_FRAMES: SpriteGrid[] = [0, 1, 2].map(dustFrame);

export interface VfxSprite {
  grid: SpriteGrid;
  anchorY: number;
  frames?: SpriteGrid[];
}

export const VFX_SPRITES: Record<string, VfxSprite> = {
  'vfx.smoke': { grid: SMOKE_FRAMES[0], anchorY: 0, frames: SMOKE_FRAMES },
  'vfx.dust': { grid: DUST_FRAMES[0], anchorY: 8, frames: DUST_FRAMES },
};
