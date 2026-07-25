export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;

export class Camera {
  x: number;
  y: number;
  zoom: number;

  constructor(x = 0, y = 0, zoom = 1) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
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

  /** Zoom while keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, nextZoom: number): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (clamped === this.zoom) return;
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = clamped;
    this.x = wx - sx / this.zoom;
    this.y = wy - sy / this.zoom;
  }

  /** Fit the world in the viewport with a small margin, centered. */
  fitWorld(worldWidth: number, worldHeight: number, viewWidth: number, viewHeight: number, margin = 0.92): void {
    const zoomX = viewWidth / worldWidth;
    const zoomY = viewHeight / worldHeight;
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(zoomX, zoomY) * margin));
    this.centerOnWorld(worldWidth, worldHeight, viewWidth, viewHeight);
  }

  /** Center the camera on a world-sized map given the viewport size in CSS pixels. */
  centerOnWorld(worldWidth: number, worldHeight: number, viewWidth: number, viewHeight: number): void {
    this.x = (worldWidth - viewWidth / this.zoom) / 2;
    this.y = (worldHeight - viewHeight / this.zoom) / 2;
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
