import type { BuildingView, CropView, VillagerView } from '../state/types';

const BUILDING_COLORS = ['#c4a574', '#8fbc5a', '#b08968'];
const CROP_STAGE_COLORS = ['#6b8f3c', '#7fa84a', '#c4b44a', '#d4a017'];

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

export function drawBuildings(
  ctx: CanvasRenderingContext2D,
  buildings: BuildingView[],
  tileSize: number,
  footprints: Array<[number, number]>,
): void {
  for (const building of buildings) {
    const [fw, fh] = footprints[building.kind] ?? [1, 1];
    const width = (building.rot % 2 === 0 ? fw : fh) * tileSize;
    const height = (building.rot % 2 === 0 ? fh : fw) * tileSize;
    const x = building.x * tileSize;
    const y = building.y * tileSize;
    const color = BUILDING_COLORS[building.kind] ?? '#ff00ff';
    ctx.globalAlpha = building.state === 2 ? 1 : 0.55 + building.progress / 250;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = building.state === 2 ? '#2b2118' : '#5a4634';
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    if (building.state !== 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 4, y + height - 10, ((width - 8) * building.progress) / 100, 4);
    }
  }
}

/** Stage-based crop markers (size/color progression for M6). */
export function drawCrops(
  ctx: CanvasRenderingContext2D,
  crops: CropView[],
  tileSize: number,
): void {
  for (const crop of crops) {
    const pad = Math.max(4, tileSize * (0.35 - crop.stage * 0.05));
    const size = tileSize - pad * 2;
    const x = crop.x * tileSize + pad;
    const y = crop.y * tileSize + pad;
    ctx.fillStyle = CROP_STAGE_COLORS[crop.stage] ?? CROP_STAGE_COLORS[CROP_STAGE_COLORS.length - 1];
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#2a3a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  }
}
