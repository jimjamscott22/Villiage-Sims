import type { BuildingView, VillagerDetail, VillagerView } from '../state/types';

/** AgentState::MovingTo */
export const STATE_MOVING = 1;
/** AgentState::Working */
export const STATE_WORKING = 2;

/** MovePurpose wire labels — mirror AgentState::label for MovingTo. */
export const PURPOSE_LABELS = [
  'Moving',
  'Going to work',
  'Wandering',
  'Fetching water',
] as const;

const ACTIVITY_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  waiting: 'Waiting',
  talking: 'Talking',
  visiting: 'Taking a stroll',
  break: 'Taking a break',
};

export interface IntentPlan {
  /** Villager world-pixel position. */
  fromX: number;
  fromY: number;
  /** Destination tile (inclusive origin for a 1×1 mark). */
  tileX: number;
  tileY: number;
  /** Footprint in tiles for the destination marker (buildings may be >1×1). */
  footprintW: number;
  footprintH: number;
  label: string;
  /** False when already at / standing on the destination (leisure pause). */
  showLine: boolean;
}

export interface PlanIntentInput {
  selectedId: number | null;
  villagers: ReadonlyArray<VillagerView>;
  buildings: ReadonlyArray<BuildingView>;
  /** Footprints by building kind index; fallback [1,1]. */
  footprints?: ReadonlyArray<[number, number]>;
  detail?: VillagerDetail | null;
  tileSize: number;
}

/** Map purpose byte / activity / detail into a short HUD reason. */
export function intentLabel(villager: VillagerView, detail?: VillagerDetail | null): string {
  if (villager.activity && ACTIVITY_LABELS[villager.activity]) {
    return ACTIVITY_LABELS[villager.activity];
  }
  if (villager.state === STATE_MOVING && villager.purpose != null) {
    return PURPOSE_LABELS[villager.purpose] ?? 'Moving';
  }
  if (villager.state === STATE_WORKING) {
    if (detail?.jobKind) {
      return detail.jobKind.replace(/_/g, ' ');
    }
    return 'Working';
  }
  return detail?.stateLabel ?? PURPOSE_LABELS[0];
}

/**
 * Pure intent overlay for the selected villager: destination while moving /
 * leisure / social stand, or job site while working.
 */
export function planIntentOverlay(input: PlanIntentInput): IntentPlan | null {
  const { selectedId, villagers, buildings, footprints, detail, tileSize } = input;
  if (selectedId == null) return null;

  const villager = villagers.find((entry) => entry.id === selectedId);
  if (!villager) return null;

  const state = villager.state ?? 0;

  if (villager.destination) {
    const [tileX, tileY] = villager.destination;
    const toX = tileX * tileSize + tileSize / 2;
    const toY = tileY * tileSize + tileSize / 2;
    const dist = Math.hypot(villager.x - toX, villager.y - toY);
    return {
      fromX: villager.x,
      fromY: villager.y,
      tileX,
      tileY,
      footprintW: 1,
      footprintH: 1,
      label: intentLabel(villager, detail),
      showLine: state === STATE_MOVING && dist > tileSize * 0.25,
    };
  }

  if (state === STATE_WORKING && detail?.jobSite != null) {
    const building = buildings.find((entry) => entry.id === detail.jobSite);
    if (!building) return null;
    const [fw, fh] = footprints?.[building.kind] ?? [1, 1];
    const width = building.rot % 2 === 0 ? fw : fh;
    const height = building.rot % 2 === 0 ? fh : fw;
    return {
      fromX: villager.x,
      fromY: villager.y,
      tileX: building.x,
      tileY: building.y,
      footprintW: width,
      footprintH: height,
      label: intentLabel(villager, detail),
      showLine: false,
    };
  }

  return null;
}

const INTENT_COLOR = '#f4c95d';
const INTENT_MUTED = 'rgba(244, 201, 93, 0.85)';
const LABEL_FONT = '600 11px ui-sans-serif, system-ui, sans-serif';

export interface IntentCamera {
  worldToScreen(wx: number, wy: number): [number, number];
}

/**
 * Draw a planned intent overlay in CSS-pixel screen space (resets transform to
 * `dpr`), matching name-tag readability at any zoom.
 */
export function drawIntentOverlay(
  ctx: CanvasRenderingContext2D,
  plan: IntentPlan,
  tileSize: number,
  camera: IntentCamera,
  dpr: number,
): void {
  const x0 = plan.tileX * tileSize;
  const y0 = plan.tileY * tileSize;
  const w = plan.footprintW * tileSize;
  const h = plan.footprintH * tileSize;
  const toWorldX = x0 + w / 2;
  const toWorldY = y0 + h / 2;
  const [fromSx, fromSy] = camera.worldToScreen(plan.fromX, plan.fromY);
  const [toSx, toSy] = camera.worldToScreen(toWorldX, toWorldY);
  const [tileSx, tileSy] = camera.worldToScreen(x0, y0);
  const [tileEx, tileEy] = camera.worldToScreen(x0 + w, y0 + h);
  const left = Math.min(tileSx, tileEx);
  const top = Math.min(tileSy, tileEy);
  const right = Math.max(tileSx, tileEx);
  const bottom = Math.max(tileSy, tileEy);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (plan.showLine) {
    ctx.strokeStyle = INTENT_MUTED;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fromSx, fromSy);
    ctx.lineTo(toSx, toSy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const inset = 2;
  const tick = 7;
  ctx.strokeStyle = INTENT_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + inset, top + inset + tick);
  ctx.lineTo(left + inset, top + inset);
  ctx.lineTo(left + inset + tick, top + inset);
  ctx.moveTo(right - inset - tick, top + inset);
  ctx.lineTo(right - inset, top + inset);
  ctx.lineTo(right - inset, top + inset + tick);
  ctx.moveTo(left + inset, bottom - inset - tick);
  ctx.lineTo(left + inset, bottom - inset);
  ctx.lineTo(left + inset + tick, bottom - inset);
  ctx.moveTo(right - inset - tick, bottom - inset);
  ctx.lineTo(right - inset, bottom - inset);
  ctx.lineTo(right - inset, bottom - inset - tick);
  ctx.stroke();

  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const labelY = top - 4;
  const metrics = ctx.measureText(plan.label);
  const padX = 4;
  const padY = 2;
  const boxW = metrics.width + padX * 2;
  const boxH = 14;
  ctx.fillStyle = 'rgba(58, 42, 12, 0.92)';
  ctx.fillRect(toSx - boxW / 2, labelY - boxH, boxW, boxH);
  ctx.strokeStyle = INTENT_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(toSx - boxW / 2 + 0.5, labelY - boxH + 0.5, boxW - 1, boxH - 1);
  ctx.fillStyle = '#fff6d5';
  ctx.fillText(plan.label, toSx, labelY - padY);

  ctx.restore();
}
