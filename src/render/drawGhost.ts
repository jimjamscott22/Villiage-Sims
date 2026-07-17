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
  ctx.fillStyle = valid ? 'rgba(80, 200, 120, 0.35)' : 'rgba(220, 70, 70, 0.35)';
  ctx.strokeStyle = valid ? 'rgba(40, 160, 90, 0.95)' : 'rgba(200, 50, 50, 0.95)';
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}
