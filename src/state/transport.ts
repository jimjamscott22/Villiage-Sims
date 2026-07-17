import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { TerrainSnapshot, TickListener, TickSnapshot, Unlisten } from './types';

export const DEFAULT_WIDTH = 128;
export const DEFAULT_HEIGHT = 128;
export const DEFAULT_TILE_SIZE = 32;
export const DEFAULT_SEED = 42;
const TICK_MS = 50;

interface Transport {
  readonly mode: 'tauri' | 'browser-demo';
  getTerrain(): Promise<TerrainSnapshot>;
  listenToTicks(listener: TickListener): Promise<Unlisten>;
  setViewport(x: number, y: number, w: number, h: number): Promise<void>;
}

/** Demo-only value noise — not byte-identical to Rust, but same thresholds/island mask. */
function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x + seed * 374761393, 668265263) ^ Math.imul(y + seed * 668265263, 374761393);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  return nx0 * (1 - sy) + nx1 * sy;
}

function fbm(x: number, y: number, seed: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 0.03;
  for (let octave = 0; octave < 4; octave += 1) {
    value += smoothNoise(x * freq * 32, y * freq * 32, seed + octave * 97) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

function classify(elev: number, moisture: number): number {
  if (elev < 0.28) return 0;
  if (elev < 0.34) return 1;
  if (elev < 0.40) return 2;
  if (elev < 0.62) return moisture > 0.55 ? 4 : 3;
  if (elev < 0.78) return 5;
  return 6;
}

export function generateDemoTerrain(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  tileSize = DEFAULT_TILE_SIZE,
  seed = DEFAULT_SEED,
): TerrainSnapshot {
  const centerX = (width - 1) * 0.5;
  const centerY = (height - 1) * 0.5;
  const maxRadius = Math.hypot(centerX, centerY) || 1;
  const tiles = new Array<number>(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rawElev = fbm(x, y, seed);
      const rawMoist = fbm(x + 1000, y + 1000, seed + 91);
      const dist = Math.hypot((x - centerX) / maxRadius, (y - centerY) / maxRadius);
      const elev = Math.min(1, Math.max(0, rawElev * 0.65 + 0.35 - dist * 0.85));
      tiles[y * width + x] = classify(elev, rawMoist);
    }
  }

  return { width, height, tileSize, tiles };
}

function demoSnapshot(tick: number, width: number, height: number, tileSize: number): TickSnapshot {
  const worldWidth = width * tileSize;
  const worldHeight = height * tileSize;
  const centerX = worldWidth / 2;
  const centerY = worldHeight / 2;
  const radius = Math.min(worldWidth, worldHeight) * 0.32;
  const angle = (tick * Math.PI * 2) / 200;
  return {
    tick,
    villagers: [{ id: 1, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius }],
  };
}

class BrowserTransport implements Transport {
  readonly mode = 'browser-demo' as const;
  private tick = 0;
  private elapsed = 0;
  private listeners = new Set<TickListener>();
  private timer: number | null = null;
  private readonly terrain = generateDemoTerrain();

  async getTerrain(): Promise<TerrainSnapshot> {
    return this.terrain;
  }

  async listenToTicks(listener: TickListener): Promise<Unlisten> {
    this.listeners.add(listener);
    listener(demoSnapshot(this.tick, this.terrain.width, this.terrain.height, this.terrain.tileSize));
    if (!new URLSearchParams(location.search).has('test') && this.timer === null) {
      this.timer = window.setInterval(() => this.advance(TICK_MS), TICK_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  async setViewport(): Promise<void> {}

  advance(ms: number): void {
    this.elapsed += Math.max(0, ms);
    while (this.elapsed >= TICK_MS) {
      this.elapsed -= TICK_MS;
      this.tick += 1;
      const snapshot = demoSnapshot(this.tick, this.terrain.width, this.terrain.height, this.terrain.tileSize);
      this.listeners.forEach((listener) => listener(snapshot));
    }
  }
}

const browserTransport = new BrowserTransport();

const tauriTransport: Transport = {
  mode: 'tauri',
  getTerrain: () => invoke<TerrainSnapshot>('get_terrain'),
  listenToTicks: async (listener) => listen<TickSnapshot>('tick', (event) => listener(event.payload)),
  setViewport: (x, y, w, h) => invoke('set_viewport', { x, y, w, h }),
};

export const transport: Transport = isTauri() ? tauriTransport : browserTransport;

export function advanceDemoTime(ms: number): void {
  if (transport.mode === 'browser-demo') browserTransport.advance(ms);
}
