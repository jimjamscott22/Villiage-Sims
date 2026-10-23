/**
 * The only zoom levels the camera may sit at. At 1x and above, every art
 * pixel (ART_SCALE = 2) maps to a whole number of screen pixels; 0.25 and 0.5
 * are overview levels.
 */
export const ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Largest zoom step at or below `zoom` (MIN_ZOOM when `zoom` is below every step). */
export function snapZoomDown(zoom: number): number {
  let best: number = MIN_ZOOM;
  for (const step of ZOOM_STEPS) {
    if (step <= zoom) best = step;
  }
  return best;
}

/** Zoom step closest to `zoom`; a tie goes to the lower step. */
export function snapZoomNearest(zoom: number): number {
  let best: number = MIN_ZOOM;
  for (const step of ZOOM_STEPS) {
    if (Math.abs(step - zoom) < Math.abs(best - zoom)) best = step;
  }
  return best;
}

/** The step `direction` places above (+1) or below (-1) `zoom`, clamped to the ends. */
export function nextZoomStep(zoom: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.indexOf(snapZoomNearest(zoom) as (typeof ZOOM_STEPS)[number]);
  const nextIndex = Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction));
  return ZOOM_STEPS[nextIndex];
}

export class Camera {
  x: number;
  y: number;
  zoom: number;

  constructor(x = 0, y = 0, zoom = 1) {
    this.x = x;
    this.y = y;
    this.zoom = snapZoomNearest(zoom);
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom, (wy - this.y) * this.zoom];
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [sx / this.zoom + this.x, sy / this.zoom + this.y];
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
  }

  /**
   * Zoom while keeping the world point under (sx, sy) fixed. `nextZoom` snaps
   * to the nearest entry in ZOOM_STEPS.
   */
  zoomAt(sx: number, sy: number, nextZoom: number): void {
    const clamped = snapZoomNearest(nextZoom);
    if (clamped === this.zoom) return;
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = clamped;
    this.x = wx - sx / this.zoom;
    this.y = wy - sy / this.zoom;
  }

  /** Move one zoom step in (+1) or out (-1), anchored on the screen point (sx, sy). */
  stepZoom(sx: number, sy: number, direction: 1 | -1): void {
    this.zoomAt(sx, sy, nextZoomStep(this.zoom, direction));
  }

  /**
   * Fit the world in the viewport with a small margin, centered. Snaps down
   * to the largest zoom step that still fits (MIN_ZOOM when none does).
   */
  fitWorld(worldWidth: number, worldHeight: number, viewWidth: number, viewHeight: number, margin = 0.92): void {
    const zoomX = viewWidth / worldWidth;
    const zoomY = viewHeight / worldHeight;
    this.zoom = snapZoomDown(Math.min(zoomX, zoomY) * margin);
    this.centerOnWorld(worldWidth, worldHeight, viewWidth, viewHeight);
  }

  /** Center the camera on a world-sized map given the viewport size in CSS pixels. */
  centerOnWorld(worldWidth: number, worldHeight: number, viewWidth: number, viewHeight: number): void {
    this.x = (worldWidth - viewWidth / this.zoom) / 2;
    this.y = (worldHeight - viewHeight / this.zoom) / 2;
  }

  /** Center the camera on a specific tile given the viewport size in CSS pixels. */
  centerOnTile(
    tileX: number,
    tileY: number,
    tileSize: number,
    viewWidth: number,
    viewHeight: number,
  ): void {
    this.x = (tileX + 0.5) * tileSize - viewWidth / (2 * this.zoom);
    this.y = (tileY + 0.5) * tileSize - viewHeight / (2 * this.zoom);
  }

  applyTransform(ctx: CanvasRenderingContext2D, dpr: number): void {
    // Round the translation to whole device pixels so bitmap blits (the
    // pre-rendered terrain layer) land on the physical pixel grid instead of
    // being resampled at a fractional offset, which is what reads as "blurry"
    // despite imageSmoothingEnabled = false. Scale is left as-is; rounding it
    // too would fight the zoom-anchored-to-cursor math in `zoomAt`.
    ctx.setTransform(
      this.zoom * dpr,
      0,
      0,
      this.zoom * dpr,
      Math.round(-this.x * this.zoom * dpr),
      Math.round(-this.y * this.zoom * dpr),
    );
  }

  /**
   * Keep the visible viewport from drifting far past the world edge. Beyond
   * the generated terrain there's nothing drawn — just the canvas clear
   * color — so unclamped panning reads as falling off the edge of the
   * world instead of "you've left the map." `overscrollPx` (screen pixels,
   * so it feels consistent at any zoom) is how far past the coastline the
   * viewport may still drift.
   */
  clampToWorld(
    worldWidth: number,
    worldHeight: number,
    viewWidth: number,
    viewHeight: number,
    overscrollPx = 0,
  ): void {
    const overscroll = overscrollPx / this.zoom;
    const viewW = viewWidth / this.zoom;
    const viewH = viewHeight / this.zoom;

    if (viewW >= worldWidth) {
      this.x = (worldWidth - viewW) / 2;
    } else {
      this.x = Math.min(worldWidth - viewW + overscroll, Math.max(-overscroll, this.x));
    }

    if (viewH >= worldHeight) {
      this.y = (worldHeight - viewH) / 2;
    } else {
      this.y = Math.min(worldHeight - viewH + overscroll, Math.max(-overscroll, this.y));
    }
  }

  /** World-space viewport rectangle currently visible. */
  visibleWorldRect(viewWidth: number, viewHeight: number): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x,
      y: this.y,
      w: viewWidth / this.zoom,
      h: viewHeight / this.zoom,
    };
  }
}
