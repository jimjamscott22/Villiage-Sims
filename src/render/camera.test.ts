import { describe, expect, it } from 'vitest';
import { Camera, MAX_ZOOM, MIN_ZOOM } from './camera';

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

  it('fits a smaller world without hitting the clamp', () => {
    const camera = new Camera();
    camera.fitWorld(1024, 768, 1280, 800);
    expect(camera.zoom).toBeCloseTo(Math.min(1280 / 1024, 800 / 768) * 0.92, 5);
  });
});
