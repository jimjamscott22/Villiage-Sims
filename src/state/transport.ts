import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { DemoWorld, DEMO_CATALOG } from './demoWorld';
import type {
  Catalog,
  PlacementResult,
  PlacementValidity,
  TerrainSnapshot,
  TickListener,
  TickSnapshot,
  Unlisten,
} from './types';
import { generateDemoTerrain } from './demoTerrain';

export {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_TILE_SIZE,
  DEFAULT_SEED,
  generateDemoTerrain,
} from './demoTerrain';

const TICK_MS = 50;

interface Transport {
  readonly mode: 'tauri' | 'browser-demo';
  getTerrain(): Promise<TerrainSnapshot>;
  getCatalog(): Promise<Catalog>;
  listenToTicks(listener: TickListener): Promise<Unlisten>;
  setViewport(x: number, y: number, w: number, h: number): Promise<void>;
  validatePlacement(kind: string, x: number, y: number, rotation: number): Promise<PlacementValidity>;
  placeBuilding(kind: string, x: number, y: number, rotation: number): Promise<PlacementResult>;
  demolish(entityId: number): Promise<void>;
  moveVillagerTo(x: number, y: number): Promise<void>;
}

class BrowserTransport implements Transport {
  readonly mode = 'browser-demo' as const;
  private elapsed = 0;
  private listeners = new Set<TickListener>();
  private timer: number | null = null;
  private readonly world = new DemoWorld(generateDemoTerrain());

  async getTerrain(): Promise<TerrainSnapshot> {
    return this.world.terrain;
  }

  async getCatalog(): Promise<Catalog> {
    return DEMO_CATALOG;
  }

  async listenToTicks(listener: TickListener): Promise<Unlisten> {
    this.listeners.add(listener);
    listener(this.world.snapshot());
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

  async setViewport(x: number, y: number, w: number, h: number): Promise<void> {
    this.world.setViewport(x, y, w, h);
  }

  async validatePlacement(kind: string, x: number, y: number, rotation: number): Promise<PlacementValidity> {
    return this.world.validatePlacement(kind, x, y, rotation);
  }

  async placeBuilding(kind: string, x: number, y: number, rotation: number): Promise<PlacementResult> {
    const result = this.world.placeBuilding(kind, x, y, rotation);
    this.emit(this.world.snapshot());
    return result;
  }

  async demolish(entityId: number): Promise<void> {
    this.world.demolish(entityId);
    this.emit(this.world.snapshot());
  }

  async moveVillagerTo(x: number, y: number): Promise<void> {
    this.world.moveVillagerTo(x, y);
    this.emit(this.world.snapshot());
  }

  advance(ms: number): void {
    this.elapsed += Math.max(0, ms);
    while (this.elapsed >= TICK_MS) {
      this.elapsed -= TICK_MS;
      this.emit(this.world.advance());
    }
  }

  private emit(snapshot: TickSnapshot): void {
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

const browserTransport = new BrowserTransport();

const tauriTransport: Transport = {
  mode: 'tauri',
  getTerrain: () => invoke<TerrainSnapshot>('get_terrain'),
  getCatalog: () => invoke<Catalog>('get_catalog'),
  listenToTicks: async (listener) => listen<TickSnapshot>('tick', (event) => listener(event.payload)),
  setViewport: (x, y, w, h) => invoke('set_viewport', { x, y, w, h }),
  validatePlacement: (kind, x, y, rotation) =>
    invoke<PlacementValidity>('validate_placement', { kind, x, y, rotation }),
  placeBuilding: (kind, x, y, rotation) =>
    invoke<PlacementResult>('place_building', { kind, x, y, rotation }),
  demolish: (entityId) => invoke('demolish', { entityId }),
  moveVillagerTo: (x, y) => invoke('move_villager_to', { x, y }),
};

export const transport: Transport = isTauri() ? tauriTransport : browserTransport;

export function advanceDemoTime(ms: number): void {
  if (transport.mode === 'browser-demo') browserTransport.advance(ms);
}

declare global {
  interface Window {
    __villageTransport?: Transport;
  }
}

// Expose the live transport for cloud/browser smoke tests (same instance as Canvas).
if (typeof window !== 'undefined' && transport.mode === 'browser-demo') {
  window.__villageTransport = transport;
}
