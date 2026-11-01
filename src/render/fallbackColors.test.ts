import { describe, expect, it } from 'vitest';
import { THEME } from '../theme/palette';
import { BUILDING_FALLBACK_COLORS, CROP_STAGE_FALLBACK_COLORS } from './drawEntities';
import { TERRAIN_FALLBACK_COLORS } from './drawTerrain';

const THEME_HEX = new Set<string>(Object.values(THEME));

describe('flat fallback colours', () => {
  it('cover every terrain type with a palette colour', () => {
    expect(TERRAIN_FALLBACK_COLORS).toEqual([
      THEME.seaDeep,
      THEME.seaShallow,
      THEME.sandMid,
      THEME.vegMid,
      THEME.vegDark,
      THEME.stoneMid,
      THEME.stonePale,
    ]);
  });

  it('use only palette colours for buildings and crop stages', () => {
    for (const color of [...BUILDING_FALLBACK_COLORS, ...CROP_STAGE_FALLBACK_COLORS]) {
      expect(THEME_HEX.has(color)).toBe(true);
    }
    expect(CROP_STAGE_FALLBACK_COLORS).toHaveLength(4);
  });
});
