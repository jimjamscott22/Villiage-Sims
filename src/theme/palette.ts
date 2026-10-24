/**
 * App-side view of the single palette source in `tools/genart/palette.ts`.
 * Use `THEME.x` in TS and `var(--c-x)` (from the generated `palette.css`) in CSS.
 */
export { PALETTE, THEME, UI_TOKENS } from '../../tools/genart/palette';
export type { PaletteName, ThemeToken } from '../../tools/genart/palette';

/** `#rrggbb` plus an alpha in [0, 1] → an `rgba(...)` string for canvas styles. */
export function withAlpha(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Debug colour for a missing sprite or unknown enum value. The only allowed off-palette hex. */
export const DEBUG_MISSING = '#ff00ff';
