import { describe, expect, it } from 'vitest';
import {
  Camera,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEPS,
  nextZoomStep,
  snapZoomDown,
  snapZoomNearest,
} from './camera';

describe('Camera', () => {
  it('keeps the cursor world point stable when zooming', () => {
    const camera = new Camera(100, 50, 1);
    const sx = 200;
    const sy = 150;
    const [beforeX, beforeY] = camera.screenToWorld(sx, sy);

    camera.zoomAt(sx, sy, 2);

    const [afterX, afterY] = camera.screenToWorld(sx, sy);
    expect(afterX).toBeCloseTo(beforeX, 5);
    expect(afterY).toBeCloseTo(beforeY, 5);
    expect(camera.zoom).toBe(2);
  });

  it('clamps zoom to the configured range', () => {
    const camera = new Camera(0, 0, 1);
    camera.zoomAt(10, 10, 0.01);
    expect(camera.zoom).toBe(MIN_ZOOM);
    camera.zoomAt(10, 10, 99);
    expect(camera.zoom).toBe(MAX_ZOOM);
  });

  it('fits the world into the viewport, clamped to min zoom', () => {
    const camera = new Camera();
    camera.fitWorld(4096, 4096, 1280, 800);
    // Ideal fit for height is ~0.18, so we clamp to MIN_ZOOM.
    expect(camera.zoom).toBe(MIN_ZOOM);
    expect(camera.x).toBeCloseTo((4096 - 1280 / camera.zoom) / 2, 5);
    expect(camera.y).toBeCloseTo((4096 - 800 / camera.zoom) / 2, 5);
  });

  it('snaps a fit down to the largest step that still fits', () => {
    const camera = new Camera();
    // Ideal fit is min(1.25, 1.04) * 0.92 ≈ 0.96, which snaps down to 0.5.
    camera.fitWorld(1024, 768, 1280, 800);
    expect(camera.zoom).toBe(0.5);
    // A tiny world fits at ~2.76x, which snaps down to 2.
    camera.fitWorld(400, 300, 1280, 900);
    expect(camera.zoom).toBe(2);
    // A world small enough for more than 4x still stops at MAX_ZOOM.
    camera.fitWorld(64, 64, 1280, 900);
    expect(camera.zoom).toBe(MAX_ZOOM);
  });

  it('centres the viewport on a tile', () => {
    const camera = new Camera();
    camera.zoom = 1;
    camera.centerOnTile(10, 20, 32, 800, 600);
    // Tile centre is (336, 656); half the viewport is (400, 300).
    expect(camera.x).toBeCloseTo(336 - 400);
    expect(camera.y).toBeCloseTo(656 - 300);
  });

  it('accounts for zoom when centring', () => {
    const camera = new Camera();
    camera.zoom = 2;
    camera.centerOnTile(10, 20, 32, 800, 600);
    // Same tile centre, but half the viewport shrinks to (200, 150) at 2x zoom.
    expect(camera.x).toBeCloseTo(336 - 200);
    expect(camera.y).toBeCloseTo(656 - 150);
  });

  it('steps up and down through ZOOM_STEPS one level at a time', () => {
    const camera = new Camera(0, 0, 1);
    camera.stepZoom(100, 100, 1);
    expect(camera.zoom).toBe(2);
    camera.stepZoom(100, 100, 1);
    expect(camera.zoom).toBe(3);
    camera.stepZoom(100, 100, -1);
    camera.stepZoom(100, 100, -1);
    camera.stepZoom(100, 100, -1);
    expect(camera.zoom).toBe(0.5);
  });

  it('clamps stepping at both ends', () => {
    const camera = new Camera(0, 0, MAX_ZOOM);
    camera.stepZoom(0, 0, 1);
    expect(camera.zoom).toBe(MAX_ZOOM);
    camera.zoom = MIN_ZOOM;
    camera.stepZoom(0, 0, -1);
    expect(camera.zoom).toBe(MIN_ZOOM);
  });

  it('keeps the cursor world point stable when stepping', () => {
    const camera = new Camera(40, 30, 1);
    const [beforeX, beforeY] = camera.screenToWorld(320, 240);
    camera.stepZoom(320, 240, 1);
    const [afterX, afterY] = camera.screenToWorld(320, 240);
    expect(afterX).toBeCloseTo(beforeX, 5);
    expect(afterY).toBeCloseTo(beforeY, 5);
  });

  it('only ever lands on a zoom step', () => {
    const camera = new Camera(0, 0, 1.7);
    const allowed = new Set<number>(ZOOM_STEPS);
    expect(allowed.has(camera.zoom)).toBe(true);
    for (const target of [0.01, 0.3, 0.74, 1.4, 2.6, 3.51, 99]) {
      camera.zoomAt(0, 0, target);
      expect(allowed.has(camera.zoom)).toBe(true);
    }
    for (let i = 0; i < 12; i += 1) {
      camera.stepZoom(0, 0, i % 3 === 0 ? -1 : 1);
      expect(allowed.has(camera.zoom)).toBe(true);
    }
  });
});

describe('zoom step helpers', () => {
  it('snaps down and to nearest', () => {
    expect(snapZoomDown(0.1)).toBe(0.25);
    expect(snapZoomDown(0.99)).toBe(0.5);
    expect(snapZoomDown(2.99)).toBe(2);
    expect(snapZoomDown(10)).toBe(4);
    expect(snapZoomNearest(0.74)).toBe(0.5);
    expect(snapZoomNearest(0.76)).toBe(1);
    expect(snapZoomNearest(1.5)).toBe(1);
    expect(snapZoomNearest(3.6)).toBe(4);
  });

  it('finds the next step from an off-step zoom', () => {
    expect(nextZoomStep(1, 1)).toBe(2);
    expect(nextZoomStep(1, -1)).toBe(0.5);
    expect(nextZoomStep(4, 1)).toBe(4);
    expect(nextZoomStep(0.25, -1)).toBe(0.25);
  });
});
