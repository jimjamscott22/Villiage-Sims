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

  it('pans in world units scaled by zoom', () => {
    const camera = new Camera(0, 0, 2);
    camera.panBy(40, -20);
    expect(camera.x).toBe(-20);
    expect(camera.y).toBe(10);
  });
});
