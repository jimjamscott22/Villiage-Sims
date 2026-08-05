import { describe, expect, it } from 'vitest';
import { formatPerfOverlay, PerfTracker, perfEnabledFromSearch } from './perfStats';

describe('perfEnabledFromSearch', () => {
  it('detects ?perf=1', () => {
    expect(perfEnabledFromSearch('?perf=1')).toBe(true);
    expect(perfEnabledFromSearch('perf=1&test=1')).toBe(true);
    expect(perfEnabledFromSearch('?test=1')).toBe(false);
  });
});

describe('PerfTracker', () => {
  it('rolls FPS over a one-second window', () => {
    const tracker = new PerfTracker();
    for (let i = 0; i < 30; i += 1) tracker.recordFrame(100 + i * 10, 2);
    // 300ms elapsed, not yet a full window
    expect(tracker.snapshot().fps).toBe(0);
    tracker.recordFrame(1100, 2);
    expect(tracker.snapshot().fps).toBeGreaterThan(20);
  });

  it('stores draw and snapshot counters', () => {
    const tracker = new PerfTracker();
    tracker.setSnapshotBytes(1234);
    tracker.setDrawStats({
      drawListLength: 40,
      propsTotal: 1000,
      propsDrawn: 70,
      shorelineTotal: 900,
      shorelineDrawn: 30,
    });
    expect(formatPerfOverlay(tracker.snapshot())).toEqual([
      'FPS 0  frame 0.0ms',
      'draw 40  snap 1234B',
      'props 70/1000',
      'foam 30/900',
    ]);
  });
});
