import type { VillagerView } from '../state/types';

export function drawVillagers(ctx: CanvasRenderingContext2D, villagers: VillagerView[]): void {
  for (const villager of villagers) {
    ctx.beginPath();
    ctx.arc(villager.x, villager.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#f4c95d';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#352f25';
    ctx.stroke();
  }
}
