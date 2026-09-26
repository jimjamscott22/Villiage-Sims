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
const INTENT_MUTED = 'rgba(244, 201, 93, 0.55)';
const LABEL_FONT = '600 11px ui-sans-serif, system-ui, sans-serif';

/** Draw a planned intent overlay in world space (camera transform already applied). */
export function drawIntentOverlay(
  ctx: CanvasRenderingContext2D,
  plan: IntentPlan,
  tileSize: number,
  zoom: number,
): void {
  const invZoom = 1 / Math.max(zoom, 0.01);
  const x = plan.tileX * tileSize;
  const y = plan.tileY * tileSize;
  const w = plan.footprintW * tileSize;
  const h = plan.footprintH * tileSize;
  const toX = x + w / 2;
  const toY = y + h / 2;

  if (plan.showLine) {
    ctx.save();
    ctx.strokeStyle = INTENT_MUTED;
    ctx.lineWidth = 1.5 * invZoom;
    ctx.setLineDash([6 * invZoom, 4 * invZoom]);
    ctx.beginPath();
    ctx.moveTo(plan.fromX, plan.fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
  }

  const inset = 3 * invZoom;
  const tick = 6 * invZoom;
  ctx.save();
  ctx.strokeStyle = INTENT_COLOR;
  ctx.lineWidth = 1.5 * invZoom;
  ctx.setLineDash([]);
  // Corner ticks (selection-bracket style).
  ctx.beginPath();
  // TL
  ctx.moveTo(x + inset, y + inset + tick);
  ctx.lineTo(x + inset, y + inset);
  ctx.lineTo(x + inset + tick, y + inset);
  // TR
  ctx.moveTo(x + w - inset - tick, y + inset);
  ctx.lineTo(x + w - inset, y + inset);
  ctx.lineTo(x + w - inset, y + inset + tick);
  // BL
  ctx.moveTo(x + inset, y + h - inset - tick);
  ctx.lineTo(x + inset, y + h - inset);
  ctx.lineTo(x + inset + tick, y + h - inset);
  // BR
  ctx.moveTo(x + w - inset - tick, y + h - inset);
  ctx.lineTo(x + w - inset, y + h - inset);
  ctx.lineTo(x + w - inset, y + h - inset - tick);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const labelY = y - 4 * invZoom;
  const metrics = ctx.measureText(plan.label);
  const padX = 4;
  const padY = 2;
  const boxW = metrics.width + padX * 2;
  const boxH = 14;
  ctx.fillStyle = 'rgba(58, 42, 12, 0.92)';
  ctx.fillRect(toX - boxW / 2, labelY - boxH, boxW, boxH);
  ctx.strokeStyle = INTENT_COLOR;
  ctx.lineWidth = 1 * invZoom;
  ctx.strokeRect(toX - boxW / 2, labelY - boxH, boxW, boxH);
  ctx.fillStyle = '#fff6d5';
  ctx.fillText(plan.label, toX, labelY - padY);
  ctx.restore();
}
