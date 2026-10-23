import type { BuildingView, CropView, VillagerView } from '../state/types';
import { DEBUG_MISSING, THEME, withAlpha } from '../theme/palette';
import type { Atlas } from './atlas';
import { bitmapTextHeight, bitmapTextWidth, drawBitmapText } from './bitmapText';

/** Flat fallback colours (used when the atlas fails to load), indexed by building kind. */
export const BUILDING_FALLBACK_COLORS: readonly string[] = [THEME.sandMid, THEME.vegLight, THEME.stoneMid];
/** Flat fallback colours per crop growth stage. */
export const CROP_STAGE_FALLBACK_COLORS: readonly string[] = [
  THEME.vegDark,
  THEME.vegMid,
  THEME.vegLight,
  THEME.wheat,
];

/**
 * Draw a small pixel-style speech bubble above a villager. Drawn in CSS-pixel
 * screen space so the bitmap glyphs stay at a whole-pixel ×2 at any zoom.
 */
function drawThoughtBubble(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  text: string,
  zoom: number,
  atlas: Atlas | null,
): void {
  const transform = ctx.getTransform();
  const dpr = transform.a / Math.max(zoom, 0.01);
  const x = (transform.a * worldX + transform.e) / dpr;
  const y = (transform.d * worldY + transform.f) / dpr;
  const pad = 4;
  const textH = bitmapTextHeight();
  const boxW = bitmapTextWidth(text) + pad * 2;
  const boxH = textH + pad * 2;
  const bx = Math.round(x - boxW / 2);
  const by = Math.round(y - boxH - 10);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = THEME.uiBg;
  ctx.strokeStyle = THEME.highlight;
  ctx.lineWidth = 1.5;
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeRect(bx, by, boxW, boxH);
  // tiny pointer
  const pointerSize = 4;
  ctx.beginPath();
  ctx.moveTo(x - pointerSize / 2, by + boxH);
  ctx.lineTo(x, by + boxH + pointerSize);
  ctx.lineTo(x + pointerSize / 2, by + boxH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  drawBitmapText(ctx, atlas, text, bx + pad, by + pad, { color: THEME.highlight });
  ctx.restore();
}

/** Draw villagers with a roughly constant on-screen size across zoom levels. */
export function drawVillagers(
  ctx: CanvasRenderingContext2D,
  villagers: VillagerView[],
  zoom = 1,
  selectedId: number | null = null,
  atlas: Atlas | null = null,
): void {
  const radius = Math.max(6, 11 / Math.max(zoom, 0.01));
  const lineWidth = Math.max(1.5, 3 / Math.max(zoom, 0.01));
  for (const villager of villagers) {
    const selected = selectedId != null && villager.id === selectedId;
    ctx.beginPath();
    ctx.arc(villager.x, villager.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = THEME.highlight;
    ctx.fill();
    ctx.lineWidth = selected ? lineWidth * 1.4 : lineWidth;
    ctx.strokeStyle = selected ? THEME.uiText : THEME.ink;
    ctx.stroke();
    const bubble = villager.activity === 'talking' ? '...' : villager.thought;
    if (bubble) {
      drawThoughtBubble(ctx, villager.x, villager.y - radius, bubble, zoom, atlas);
    }
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
    const color = BUILDING_FALLBACK_COLORS[building.kind] ?? DEBUG_MISSING;
    ctx.globalAlpha = building.state === 2 ? 1 : 0.55 + building.progress / 250;
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = building.state === 2 ? THEME.ink : THEME.stoneShadow;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    if (building.state !== 2) {
      ctx.fillStyle = withAlpha(THEME.whitewash, 0.35);
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
    ctx.fillStyle = CROP_STAGE_FALLBACK_COLORS[crop.stage] ??
      CROP_STAGE_FALLBACK_COLORS[CROP_STAGE_FALLBACK_COLORS.length - 1];
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = THEME.vegDarkest;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  }
}
