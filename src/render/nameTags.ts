import type { Camera } from './camera';

/** Below this zoom only the selected villager keeps its tag, to avoid label soup. */
export const MIN_TAG_ZOOM = 0.4;
/** World-pixel gap between a villager's feet and the top of its tag. */
const FEET_OFFSET = 7;
const TAG_FONT = '600 11px ui-sans-serif, system-ui, sans-serif';
const TAG_PAD_X = 4;
const TAG_HEIGHT = 14;
const OFFSCREEN_MARGIN = 80;

export interface NameTagPlacement {
  id: number;
  text: string;
  /** Screen-space (CSS px) centre-x and top-y of the tag. */
  sx: number;
  sy: number;
  selected: boolean;
}

/**
 * Where to draw each villager's name tag in screen space. Tags sit just under the
 * villager's feet so they don't collide with thought bubbles drawn overhead.
 */
export function nameTagPlacements(
  villagers: ReadonlyArray<{ id: number; x: number; y: number }>,
  labels: ReadonlyMap<number, string>,
  camera: Pick<Camera, 'worldToScreen' | 'zoom'>,
  viewWidth: number,
  viewHeight: number,
  selectedId: number | null,
): NameTagPlacement[] {
  const placements: NameTagPlacement[] = [];
  for (const villager of villagers) {
    const text = labels.get(villager.id);
    if (!text) continue;
    const selected = villager.id === selectedId;
    if (!selected && camera.zoom < MIN_TAG_ZOOM) continue;
    const [sx, sy] = camera.worldToScreen(villager.x, villager.y + FEET_OFFSET);
    if (
      sx < -OFFSCREEN_MARGIN ||
      sy < -OFFSCREEN_MARGIN ||
      sx > viewWidth + OFFSCREEN_MARGIN ||
      sy > viewHeight + OFFSCREEN_MARGIN
    ) {
      continue;
    }
    placements.push({ id: villager.id, text, sx: Math.round(sx), sy: Math.round(sy), selected });
  }
  // Selected tag last so it paints on top of any overlapping neighbours.
  return placements.sort((a, b) => Number(a.selected) - Number(b.selected));
}

export interface TagRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MAX_STAGGER_ROWS = 3;

/**
 * Nudge a tag down one row at a time while it overlaps an already-placed tag, so
 * villagers standing side by side stay readable. Gives up after a few rows.
 */
export function staggerTag(rect: TagRect, placed: readonly TagRect[]): TagRect {
  let top = rect.top;
  for (let row = 0; row < MAX_STAGGER_ROWS; row += 1) {
    const hit = placed.some(
      (other) =>
        rect.left < other.left + other.width &&
        other.left < rect.left + rect.width &&
        top < other.top + other.height &&
        other.top < top + rect.height,
    );
    if (!hit) break;
    top += rect.height + 1;
  }
  return { ...rect, top };
}

/** Paint tags in CSS-pixel screen space (resets the transform to `dpr`). */
export function drawNameTags(
  ctx: CanvasRenderingContext2D,
  placements: NameTagPlacement[],
  dpr: number,
): void {
  if (placements.length === 0) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = TAG_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const placed: TagRect[] = [];
  for (const tag of placements) {
    const width = Math.ceil(ctx.measureText(tag.text).width) + TAG_PAD_X * 2;
    const rect = staggerTag(
      { left: tag.sx - Math.round(width / 2), top: tag.sy, width, height: TAG_HEIGHT },
      placed,
    );
    placed.push(rect);
    ctx.fillStyle = tag.selected ? 'rgba(58, 42, 12, 0.92)' : 'rgba(12, 18, 12, 0.72)';
    ctx.fillRect(rect.left, rect.top, width, TAG_HEIGHT);
    ctx.strokeStyle = tag.selected ? '#f4c95d' : 'rgba(247, 244, 233, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.left + 0.5, rect.top + 0.5, width - 1, TAG_HEIGHT - 1);
    ctx.fillStyle = tag.selected ? '#fff6d5' : '#f7f4e9';
    ctx.fillText(tag.text, tag.sx, rect.top + TAG_HEIGHT / 2 + 0.5);
  }
  ctx.restore();
}
