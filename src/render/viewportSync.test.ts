import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera } from './camera';
import { createViewportSync } from './viewportSync';

describe('viewport synchronization', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends the latest rectangle every 100 ms during sustained movement', () => {
    const camera = new Camera(0, 0, 1);
    const rectangles: ReturnType<Camera['visibleWorldRect']>[] = [];
    const sync = createViewportSync(() => rectangles.push(camera.visibleWorldRect(800, 600)));

    for (let frame = 1; frame <= 50; frame += 1) {
      camera.x = frame;
      sync.schedule();
      vi.advanceTimersByTime(20);
    }

    expect(rectangles).toHaveLength(10);
    expect(rectangles.map((rect) => rect.x)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  });

  it('sends the final rectangle after movement stops and then stays idle', () => {
    let x = 1;
    const send = vi.fn(() => x);
    const sync = createViewportSync(send);
    sync.schedule();
    vi.advanceTimersByTime(90);
    x = 2;
    sync.schedule();
    vi.advanceTimersByTime(10);
    expect(send).toHaveReturnedWith(2);
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('synchronizes explicit camera jumps immediately without a stale delayed send', () => {
    const send = vi.fn();
    const sync = createViewportSync(send);
    sync.schedule();
    vi.advanceTimersByTime(50);
    sync.syncNow();
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(1);
    sync.schedule();
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('cancels pending synchronization during cleanup', () => {
    const send = vi.fn();
    const sync = createViewportSync(send);
    sync.schedule();
    sync.cancel();
    vi.advanceTimersByTime(1000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
