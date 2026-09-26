/// <reference types="vite/client" />

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
    /** Centre the camera on a world-pixel point (browser-demo / ?test=1 smoke). */
    __focusWorld?: (wx: number, wy: number) => void;
    /** Live render/sim perf counters (updated every RAF / tick). */
    __villagePerf?: () => {
      fps: number;
      frameMs: number;
      drawListLength: number;
      snapshotBytes: number;
      propsTotal: number;
      propsDrawn: number;
      shorelineTotal: number;
      shorelineDrawn: number;
    };
    __villageTransport?: {
      moveVillagerTo(x: number, y: number, villagerId?: number | null): Promise<void>;
      placeBuilding(
        kind: string,
        x: number,
        y: number,
        rotation: number,
      ): Promise<{ id: number }>;
      saveGame(slot: number): Promise<void>;
      loadGame(slot: number): Promise<{
        seed: number;
        width: number;
        height: number;
        tileSize: number;
        tick: number;
        saveVersion: number;
      }>;
    };
  }
}

export {};
