import { PALETTE as P } from '../palette';
import { paintGrid, type SpriteGrid } from '../grid';
import { BUILDING_SPRITES, type BuildingSprite } from './buildings';

function blank(w: number, h: number): SpriteGrid {
  return { size: [w, h], palette: { '.': null, i: P.ink, g: P.wheat,
    t: P.terraLight, w: P.whitewash, p: P.stonePale, d: P.terraDark,
    m: P.sandMid, s: P.stoneShadow, c: P.sandShadow }, rows: Array(h).fill('.'.repeat(w)) };
}

export const BUILDING_ROOFS: Record<string, readonly [number, number]> = {
  hut: [2, 15], granary: [4, 15], bakery: [12, 18], storehouse: [6, 21], mill: [25, 28],
};

function snow(base: SpriteGrid, [top, bottom]: readonly [number, number]): SpriteGrid {
  return paintGrid(blank(...base.size), set => {
    for (let x = 0; x < base.size[0]; x += 1) {
      for (let y = top; y <= bottom; y += 1) {
        const color = base.palette[base.rows[y][x]];
        if (color !== P.terraDark && color !== P.terraMid && color !== P.terraLight) continue;
        // Follow the roof's existing silhouette; never fill transparent headroom.
        set(x, y, x % 4 === 0 ? 'p' : 'w');
        if (y + 1 <= bottom && base.palette[base.rows[y + 1][x]]) set(x, y + 1, 'p');
        if (y + 2 <= bottom && base.palette[base.rows[y + 2][x]]) set(x, y + 2, 'i');
        break;
      }
    }
  });
}

function sign(kind: 'granary' | 'bakery' | 'storehouse'): SpriteGrid {
  return paintGrid(blank(8, 8), set => {
    set(1, 0, 'i'); set(2, 0, 'i'); set(3, 0, 'i'); set(2, 1, 'i');
    for (let y = 2; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) set(x, y, y === 2 || y === 7 || x === 0 || x === 7 ? 'i' : 'd');
    }
    if (kind === 'granary') {
      for (let y = 3; y <= 6; y += 1) set(4, y, 'g');
      set(3, 3, 'g'); set(5, 4, 'g'); set(3, 5, 'g');
    } else if (kind === 'bakery') {
      for (let x = 2; x <= 5; x += 1) { set(x, 5, 'g'); set(x, 6, 't'); }
      set(3, 4, 'w'); set(4, 4, 'g'); set(5, 5, 'w');
    } else {
      for (let y = 3; y <= 6; y += 1) {
        for (let x = 2; x <= 5; x += 1) set(x, y, x === y - 1 || x === 6 - y ? 't' : 'm');
      }
    }
  });
}

function storage(kind: 'barrel' | 'crate' | 'sack'): SpriteGrid {
  return paintGrid(blank(16, 16), set => {
    for (let y = 4; y <= 13; y += 1) {
      const inset = kind === 'crate' ? 3 : y === 4 || y === 13 ? 5 : 4;
      for (let x = inset; x < 16 - inset; x += 1) {
        const edge = x === inset || x === 15 - inset || y === 4 || y === 13;
        let pixel = x < 7 ? 't' : 'm';
        if (kind === 'barrel' && (y === 7 || y === 11)) pixel = 's';
        if (kind === 'crate' && (x === y - 1 || x === 15 - y)) pixel = 'd';
        if (kind === 'sack') pixel = (x + y) % 4 === 0 ? 'p' : 'm';
        set(x, y, edge ? 'i' : pixel);
      }
    }
    if (kind === 'sack') { set(7, 2, 'm'); set(8, 2, 'p'); set(7, 3, 'i'); set(8, 3, 'i'); }
    for (let x = 3; x <= 12; x += 1) set(x, 14, 'c');
  });
}

export const BUILDING_DETAILS: Record<string, BuildingSprite> = {};
for (const [key, bounds] of Object.entries(BUILDING_ROOFS)) {
  const base = BUILDING_SPRITES[key];
  BUILDING_DETAILS[`${key}.snow`] = { grid: snow(base.grid, bounds), anchorY: base.anchorY };
}
for (const key of ['granary', 'bakery', 'storehouse'] as const) {
  BUILDING_DETAILS[`${key}.sign`] = { grid: sign(key), anchorY: 0 };
}
for (const key of ['barrel', 'crate', 'sack'] as const) {
  BUILDING_DETAILS[`prop.${key}`] = { grid: storage(key), anchorY: 0 };
}
