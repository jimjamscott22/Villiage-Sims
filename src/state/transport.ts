import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { TerrainSnapshot, TickListener, TickSnapshot, Unlisten } from './types';

const WIDTH = 32;
const HEIGHT = 24;
const TILE_SIZE = 32;
const TICK_MS = 50;

interface Transport {
  readonly mode: 'tauri' | 'browser-demo';
  getTerrain(): Promise<TerrainSnapshot>;
  listenToTicks(listener: TickListener): Promise<Unlisten>;
}

const terrain: TerrainSnapshot = {
  width: WIDTH,
  height: HEIGHT,
  tileSize: TILE_SIZE,
  tiles: Array.from({ length: WIDTH * HEIGHT }, (_, index) =>
    ((index % WIDTH) + Math.floor(index / WIDTH)) % 2,
  ),
};

function demoSnapshot(tick: number): TickSnapshot {
  const centerX = (WIDTH * TILE_SIZE) / 2;
  const centerY = (HEIGHT * TILE_SIZE) / 2;
  const radius = Math.min(WIDTH * TILE_SIZE, HEIGHT * TILE_SIZE) * 0.32;
  const angle = tick * Math.PI * 2 / 200;
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

  async getTerrain(): Promise<TerrainSnapshot> {
    return terrain;
  }

  async listenToTicks(listener: TickListener): Promise<Unlisten> {
    this.listeners.add(listener);
    listener(demoSnapshot(this.tick));
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

  advance(ms: number): void {
    this.elapsed += Math.max(0, ms);
    while (this.elapsed >= TICK_MS) {
      this.elapsed -= TICK_MS;
      this.tick += 1;
      const snapshot = demoSnapshot(this.tick);
      this.listeners.forEach((listener) => listener(snapshot));
    }
  }
}

const browserTransport = new BrowserTransport();

const tauriTransport: Transport = {
  mode: 'tauri',
  getTerrain: () => invoke<TerrainSnapshot>('get_terrain'),
  listenToTicks: async (listener) => listen<TickSnapshot>('tick', (event) => listener(event.payload)),
};

export const transport = isTauri() ? tauriTransport : browserTransport;

export function advanceDemoTime(ms: number): void {
  if (transport.mode === 'browser-demo') browserTransport.advance(ms);
}
