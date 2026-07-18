/// <reference types="vite/client" />

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    render_game_to_text?: () => string;
    __villageTransport?: {
      moveVillagerTo(x: number, y: number): Promise<void>;
      placeBuilding(
        kind: string,
        x: number,
        y: number,
        rotation: number,
      ): Promise<{ id: number }>;
    };
  }
}

export {};
