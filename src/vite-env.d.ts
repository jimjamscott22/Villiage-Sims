/// <reference types="vite/client" />

declare global {
  interface Window {
    advanceTime?: (ms: number) => void;
    advanceClock?: (days: number, season?: number | null) => void;
    render_game_to_text?: () => string;
    __villageTransport?: {
      moveVillagerTo(x: number, y: number): Promise<void>;
      placeBuilding(
        kind: string,
        x: number,
        y: number,
        rotation: number,
      ): Promise<{ id: number }>;
      plantCrop?(kind: string, x: number, y: number): Promise<void>;
      setSpeed?(speed: number): Promise<void>;
      advanceClock?(days: number, season?: number | null): Promise<void>;
    };
  }
}

export {};
