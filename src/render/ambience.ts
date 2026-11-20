import { THEME } from '../theme/palette';

export interface Ambience { color: string; alpha: number; warmAlpha: number }

// Night matches sim/utility.rs (20:00–06:00). Warm dawn/dusk peaks at 07:00/19:00.
const KEYS = [
  [0, 0.45], [360, 0.45], [420, 0], [480, 0],
  [1080, 0], [1140, 0], [1200, 0.45], [1440, 0.45],
] as const;

/** Cyclic daily tint; blue and amber layers crossfade continuously. */
export function ambienceFor(minute: number): Ambience {
  const m = Number.isFinite(minute) ? ((minute % 1440) + 1440) % 1440 : 720;
  for (let i = 1; i < KEYS.length; i += 1) {
    const [end, alpha] = KEYS[i];
    const [start, previous] = KEYS[i - 1];
    if (m <= end) {
      return {
        color: THEME.seaDeepest,
        warmAlpha: Math.max(0, 1 - Math.min(Math.abs(m - 420), Math.abs(m - 1140)) / 60) * 0.15,
        alpha: previous + (alpha - previous) * (m - start) / (end - start),
      };
    }
  }
  return { color: THEME.seaDeepest, alpha: 0.45, warmAlpha: 0 };
}
