import { PALETTE as P } from '../palette';
import type { SpriteGrid } from '../grid';

function sprite(w: number, h: number, paint: (set: (x: number, y: number, key: string) => void) => void): SpriteGrid {
  const rows = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  paint((x, y, key) => { if (x >= 0 && y >= 0 && x < w && y < h) rows[y][x] = key; });
  return { size: [w, h], palette: { '.': null, w: P.whitewash, s: P.stoneLight, i: P.ink,
    r: P.terraMid, d: P.terraDark, l: P.terraLight, b: P.wheat, t: P.sandShadow, g: P.vegDark }, rows: rows.map(r => r.join('')) };
}
function chicken(pose: string, frame: number): SpriteGrid {
  return sprite(12, 14, set => {
    const sleeping = pose === 'sleep', low = sleeping || pose === 'peck';
    const lift = pose === 'hop' ? (frame === 0 ? 3 : 1) : pose === 'startled' ? 1 : 0;
    // Soft contact shadow, fan tail, plump body, and small near wing.
    for (let x = 2; x <= 9; x++) set(x, 13, 't');
    for (let y = 6 - lift; y <= 10 - lift; y++) for (let x = 3; x <= 8; x++) set(x, y, y === 10 - lift ? 's' : 'w');
    set(1, 5 - lift, 'w'); set(2, 6 - lift, 'w'); set(2, 7 - lift, 's');
    for (let x = 4; x <= 6; x++) set(x, 8 - lift, 's');
    const headY = low ? 9 : pose === 'tilt' ? 3 : 4;
    for (let y = headY - lift; y <= headY + 2 - lift; y++) for (let x = 7; x <= 9; x++) set(x, y, 'w');
    set(8, headY - 1 - lift, 'r'); set(9, headY - 1 - lift, 'r');
    set(9, headY + 1 - lift, 'i'); set(10, headY + 2 - lift, 'b');
    if (sleeping) { set(8, 10, 's'); set(9, 10, 's'); return; }
    const step = pose === 'walk' || pose === 'startled' || pose === 'scratch' ? frame : 0;
    set(4 - step, 11 - lift, 'b'); set(4 - step, 12 - lift, 'b');
    set(7 + step, 11 - lift, 'b'); set(8 + step, 12 - lift, 'b');
    if (pose === 'scratch') { set(1 + frame, 12, 't'); set(frame, 11, 't'); }
    if (pose === 'peck' && frame) set(10, 12, 'b');
    if (pose === 'startled') { set(3, 4, 'w'); set(5, 3, 'w'); }
  });
}
const shelter = sprite(16, 28, set => {
  for (let y = 5; y < 15; y++) for (let x = Math.max(0, 7 - (y - 5)); x <= Math.min(15, 8 + (y - 5)); x++) set(x, y, y % 3 === 0 ? 'd' : 'r');
  for (let y = 15; y < 24; y++) for (let x = 2; x < 14; x++) set(x, y, x === 2 || x === 13 ? 't' : 'l');
  for (let y = 18; y < 24; y++) for (let x = 6; x < 10; x++) set(x, y, 'i');
  for (let x = 5; x <= 10; x++) { set(x, 24, 't'); set(x, 25, 's'); }
  set(3, 24, 'd'); set(12, 24, 'd');
  for (let x = 1; x <= 14; x++) set(x, 27, 't');
});
const basket = sprite(6, 7, set => {
  set(1, 0, 't'); set(2, 0, 't'); set(3, 0, 't'); set(4, 0, 't');
  for (let y = 2; y <= 5; y++) for (let x = 0; x < 6; x++) set(x, y, y % 2 ? 'b' : 't');
  set(1, 2, 'w'); set(2, 1, 'w'); set(3, 2, 'w'); set(4, 1, 'w');
  for (let x = 1; x <= 4; x++) set(x, 6, 't');
});
export const CHICKEN_SPRITES: Record<string, { grid: SpriteGrid; anchorY: number; frames?: SpriteGrid[] }> = {
  chicken_shelter: { grid: shelter, anchorY: 12 },
  'chicken.basket': { grid: basket, anchorY: 0 },
};
for (const pose of ['walk', 'peck', 'scratch', 'rest', 'sleep', 'tilt', 'startled', 'hop']) {
  const frames = ['sleep', 'rest', 'tilt'].includes(pose) ? [chicken(pose, 0)] : [chicken(pose, 0), chicken(pose, 1)];
  CHICKEN_SPRITES[`chicken.${pose}`] = { grid: frames[0], frames, anchorY: 0 };
}
