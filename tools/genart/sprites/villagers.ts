import { PALETTE } from '../palette';
import type { SpriteGrid } from '../grid';

const P = PALETTE;

/** Garment dye placeholder — remapped to six palette dyes at pack time. */
export const DYE_PLACEHOLDER = P.shutter;

export const VILLAGER_DYES = [
  P.shutter,
  P.terraMid,
  P.seaMid,
  P.wheat,
  P.vegDark,
  P.terraDark,
  P.vegMid,
  P.seaDeep,
  P.terraLight,
] as const;

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

const BODY: Pal = {
  i: P.ink,
  s: P.sandLight,
  k: P.sandMid,
  d: DYE_PLACEHOLDER,
  p: P.stonePale,
  c: P.sandShadow,
  h: P.terraDark,
};

type Facing = 'n' | 'e' | 's';

/**
 * Burlap sack held by a hauling villager, plus the arms that grip it. Painted over
 * the torso, so it replaces the default arms rather than adding to them. The sack
 * reuses the body palette's sand keys — no new colors enter the sprite.
 */
function paintCarry(facing: Facing, set: (x: number, y: number, k: string) => void): void {
  if (facing === 's') {
    // Sack held against the belly; dye stays visible at the chest (y 8..9) and hem (y 14).
    for (let x = 5; x <= 10; x += 1) set(x, 10, 'c');
    for (let y = 11; y <= 12; y += 1) {
      for (let x = 4; x <= 11; x += 1) set(x, y, 'k');
    }
    for (let x = 5; x <= 10; x += 1) set(x, 13, 'k');
    // Weave texture so the sack does not read as a flat block.
    set(6, 12, 'c');
    set(9, 11, 'c');
    // Arms wrapped around the load.
    set(3, 11, 's');
    set(3, 12, 's');
    set(12, 11, 's');
    set(12, 12, 's');
    return;
  }

  if (facing === 'e') {
    // Sack carried out front, clear of the silhouette.
    for (let x = 12; x <= 14; x += 1) set(x, 9, 'c');
    for (let y = 10; y <= 12; y += 1) {
      for (let x = 11; x <= 15; x += 1) set(x, y, 'k');
    }
    for (let x = 12; x <= 14; x += 1) set(x, 13, 'k');
    set(13, 11, 'c');
    set(11, 9, 's');
    return;
  }

  // North — the sack is occluded by the body, so carrying reads from the shoulder
  // strap across the back and the sack bulging out at either side.
  for (let x = 5; x <= 10; x += 1) set(x, 9, 'c');
  set(4, 10, 'c');
  set(11, 10, 'c');
  for (let y = 11; y <= 12; y += 1) {
    set(4, y, 'k');
    set(11, y, 'k');
  }
}

function villagerPose(
  facing: Facing,
  walkFrame: number | 'idle' | 'lie',
  carry = false,
): SpriteGrid {
  if (walkFrame === 'lie') {
    return grid(16, 24, BODY, (set) => {
      // Lying on side
      for (let x = 2; x <= 13; x += 1) {
        set(x, 16, 'd');
        set(x, 17, 'd');
      }
      for (let x = 3; x <= 7; x += 1) {
        set(x, 15, 's');
        set(x, 14, 's');
      }
      set(4, 13, 'h');
      set(5, 13, 'h');
      set(6, 13, 'h');
      for (let x = 1; x <= 14; x += 1) set(x, 18, 'c');
    });
  }

  const legPhase = walkFrame === 'idle' ? 0 : (walkFrame as number);
  return grid(16, 24, BODY, (set) => {
    // Head
    for (let y = 2; y <= 7; y += 1) {
      for (let x = 5; x <= 10; x += 1) {
        if (y === 2 || y === 7 || x === 5 || x === 10) set(x, y, 'i');
        else set(x, y, 's');
      }
    }
    // Hair
    for (let x = 5; x <= 10; x += 1) set(x, 2, 'h');
    for (let x = 6; x <= 9; x += 1) set(x, 1, 'h');

    if (facing === 's') {
      set(6, 4, 'i');
      set(9, 4, 'i');
      set(7, 6, 'k');
      set(8, 6, 'k');
    } else if (facing === 'e') {
      set(9, 4, 'i');
      set(9, 5, 'k');
    } else {
      // north — back of head, no face
      for (let x = 6; x <= 9; x += 1) set(x, 3, 'h');
    }

    // Torso (dye)
    for (let y = 8; y <= 14; y += 1) {
      for (let x = 5; x <= 10; x += 1) {
        if (x === 5 || x === 10) set(x, y, 'i');
        else set(x, y, 'd');
      }
    }

    // Arms — a carried load occupies both hands, so it supplies its own.
    if (carry) {
      paintCarry(facing, set);
    } else if (facing === 'e') {
      set(11, 9, 's');
      set(12, 10, 's');
      set(12, 11, 's');
    } else if (facing === 's') {
      set(4, 9, 's');
      set(3, 10, 's');
      set(11, 9, 's');
      set(12, 10, 's');
    } else {
      set(4, 9, 's');
      set(11, 9, 's');
    }

    // Legs with walk cycle
    const leftLift = walkFrame !== 'idle' && legPhase % 2 === 0;
    const rightLift = walkFrame !== 'idle' && legPhase % 2 === 1;
    const leftY = leftLift ? 15 : 16;
    const rightY = rightLift ? 15 : 16;
    const leftX = walkFrame !== 'idle' && leftLift ? 5 : 6;
    const rightX = walkFrame !== 'idle' && rightLift ? 10 : 9;

    set(leftX, leftY, 'p');
    set(leftX, leftY + 1, 'p');
    set(leftX, leftY + 2, 'i');
    set(rightX, rightY, 'p');
    set(rightX, rightY + 1, 'p');
    set(rightX, rightY + 2, 'i');

    if (walkFrame === 'idle') {
      set(6, 15, 'p');
      set(6, 16, 'p');
      set(6, 17, 'i');
      set(9, 15, 'p');
      set(9, 16, 'p');
      set(9, 17, 'i');
    }

    // Contact shadow
    for (let x = 4; x <= 11; x += 1) {
      set(x, 20, 'c');
      set(x, 21, 'c');
    }
  });
}

export type VillagerFacing = Facing;

export const VILLAGER_POSES: Record<string, SpriteGrid> = {};

for (const facing of ['n', 'e', 's'] as const) {
  VILLAGER_POSES[`${facing}.idle`] = villagerPose(facing, 'idle');
  VILLAGER_POSES[`${facing}.carry.idle`] = villagerPose(facing, 'idle', true);
  for (let f = 0; f < 4; f += 1) {
    VILLAGER_POSES[`${facing}.walk${f}`] = villagerPose(facing, f);
    VILLAGER_POSES[`${facing}.carry.walk${f}`] = villagerPose(facing, f, true);
  }
}
// No carry variant for `lie`: nobody hauls in their sleep.
VILLAGER_POSES.lie = villagerPose('s', 'lie');

function bubble(paint: (set: (x: number, y: number, k: string) => void) => void): SpriteGrid {
  return grid(8, 8, {
    i: P.ink,
    p: P.stonePale,
    w: P.whitewash,
    u: P.uiRaised,
    t: P.wheat,
    s: P.shutter,
  }, (set) => {
    // Frame
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if (y === 0 || y === 7 || x === 0 || x === 7) set(x, y, 'i');
        else set(x, y, 'w');
      }
    }
    paint(set);
  });
}

export const BUBBLES: Record<string, SpriteGrid> = {
  'bubble.fork': bubble((set) => {
    set(3, 2, 'i');
    set(4, 2, 'i');
    set(3, 3, 'i');
    set(4, 3, 'i');
    set(3, 4, 'i');
    set(4, 4, 't');
    set(3, 5, 'i');
    set(4, 5, 'i');
  }),
  'bubble.zzz': bubble((set) => {
    set(2, 2, 's');
    set(3, 2, 's');
    set(4, 3, 's');
    set(5, 4, 's');
    set(3, 5, 's');
    set(4, 5, 's');
  }),
  'bubble.speech': bubble((set) => {
    set(2, 3, 's');
    set(3, 3, 's');
    set(4, 3, 's');
    set(5, 3, 's');
    set(2, 4, 's');
    set(5, 4, 's');
    set(3, 5, 's');
  }),
  'bubble.tool': bubble((set) => {
    set(2, 2, 'i');
    set(3, 3, 'i');
    set(4, 4, 't');
    set(5, 5, 't');
    set(3, 4, 'i');
    set(4, 3, 'i');
  }),
};
