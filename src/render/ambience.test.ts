import { describe, expect, it } from 'vitest';
import { THEME } from '../theme/palette';
import { ambienceFor } from './ambience';

describe('daily ambience', () => {
  it('leaves noon clear and darkens midnight to 45 percent', () => {
    expect(ambienceFor(720).alpha).toBe(0);
    expect(ambienceFor(720).warmAlpha).toBe(0);
    expect(ambienceFor(0).alpha).toBe(0.45);
  });
  it('matches the sim night window and ramps on either side', () => {
    expect(ambienceFor(360).alpha).toBe(0.45);
    expect(ambienceFor(1200).alpha).toBe(0.45);
    for (const minute of [390, 1170]) {
      expect(ambienceFor(minute).alpha).toBeGreaterThan(0);
      expect(ambienceFor(minute).alpha).toBeLessThan(0.45);
    }
    expect(ambienceFor(420).warmAlpha).toBe(0.15);
    expect(ambienceFor(1140).warmAlpha).toBe(0.15);
  });
  it('wraps dates, safely handles invalid input and always uses theme colours', () => {
    expect(ambienceFor(-1)).toEqual(ambienceFor(1439));
    expect(ambienceFor(1440)).toEqual(ambienceFor(0));
    expect(ambienceFor(NaN)).toEqual(ambienceFor(720));
    for (let m = 0; m < 1440; m++) expect(Object.values(THEME)).toContain(ambienceFor(m).color);
  });
  it('has continuous blue and warm layers at every keyframe, including midnight', () => {
    for (const m of [0, 360, 420, 480, 1080, 1140, 1200, 1440]) {
      const a = ambienceFor(m - 0.001), b = ambienceFor(m + 0.001);
      expect(Math.abs(a.alpha - b.alpha)).toBeLessThan(0.0001);
      expect(Math.abs(a.warmAlpha - b.warmAlpha)).toBeLessThan(0.0001);
    }
  });
});
