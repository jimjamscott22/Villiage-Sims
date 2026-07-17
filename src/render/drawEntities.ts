import type { VillagerView } from '../state/types';

/** Draw villagers with a roughly constant on-screen size across zoom levels. */
export function drawVillagers(
  ctx: CanvasRenderingContext2D,
  villagers: VillagerView[],
  zoom = 1,
): void {
  const radius = Math.max(6, 11 / Math.max(zoom, 0.01));
  const lineWidth = Math.max(1.5, 3 / Math.max(zoom, 0.01));
  for (const villager of villagers) {
    ctx.beginPath();
    ctx.arc(villager.x, villager.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f4c95d';
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = '#352f25';
    ctx.stroke();
  }
}
