import { THEME, withAlpha } from '../theme/palette';

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  footprint: [number, number],
  tileSize: number,
  valid: boolean,
): void {
  const [fw, fh] = footprint;
  const x = tileX * tileSize;
  const y = tileY * tileSize;
  const width = fw * tileSize;
  const height = fh * tileSize;
  ctx.fillStyle = valid ? withAlpha(THEME.vegLight, 0.35) : withAlpha(THEME.terraMid, 0.35);
  ctx.strokeStyle = valid ? withAlpha(THEME.vegMid, 0.95) : withAlpha(THEME.terraDark, 0.95);
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}
