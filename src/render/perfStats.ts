/** Rolling frame timing for the `?perf=1` overlay and `window.__villagePerf`. */
export interface PerfSnapshot {
  fps: number;
  frameMs: number;
  drawListLength: number;
  snapshotBytes: number;
  propsTotal: number;
  propsDrawn: number;
  shorelineTotal: number;
  shorelineDrawn: number;
}

export class PerfTracker {
  private frames = 0;
  private windowStart = 0;
  private fps = 0;
  private lastFrameMs = 0;
  private drawListLength = 0;
  private snapshotBytes = 0;
  private propsTotal = 0;
  private propsDrawn = 0;
  private shorelineTotal = 0;
  private shorelineDrawn = 0;

  /** Call once at the end of each animation frame with elapsed frame cost. */
  recordFrame(now: number, frameMs: number): void {
    this.lastFrameMs = frameMs;
    if (this.windowStart === 0) this.windowStart = now;
    this.frames += 1;
    const elapsed = now - this.windowStart;
    if (elapsed >= 1000) {
      this.fps = (this.frames * 1000) / elapsed;
      this.frames = 0;
      this.windowStart = now;
    }
  }

  setDrawStats(opts: {
    drawListLength: number;
    propsTotal: number;
    propsDrawn: number;
    shorelineTotal: number;
    shorelineDrawn: number;
  }): void {
    this.drawListLength = opts.drawListLength;
    this.propsTotal = opts.propsTotal;
    this.propsDrawn = opts.propsDrawn;
    this.shorelineTotal = opts.shorelineTotal;
    this.shorelineDrawn = opts.shorelineDrawn;
  }

  setSnapshotBytes(bytes: number): void {
    this.snapshotBytes = bytes;
  }

  snapshot(): PerfSnapshot {
    return {
      fps: this.fps,
      frameMs: this.lastFrameMs,
      drawListLength: this.drawListLength,
      snapshotBytes: this.snapshotBytes,
      propsTotal: this.propsTotal,
      propsDrawn: this.propsDrawn,
      shorelineTotal: this.shorelineTotal,
      shorelineDrawn: this.shorelineDrawn,
    };
  }
}

/** True when the page URL requests the perf overlay (`?perf=1`). */
export function perfEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('perf') === '1';
}

/** Format overlay lines (kept pure for tests). */
export function formatPerfOverlay(stats: PerfSnapshot): string[] {
  return [
    `FPS ${stats.fps.toFixed(0)}  frame ${stats.frameMs.toFixed(1)}ms`,
    `draw ${stats.drawListLength}  snap ${stats.snapshotBytes}B`,
    `props ${stats.propsDrawn}/${stats.propsTotal}`,
    `foam ${stats.shorelineDrawn}/${stats.shorelineTotal}`,
  ];
}
