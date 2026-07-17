export interface TerrainSnapshot {
  width: number;
  height: number;
  tileSize: number;
  tiles: number[];
}

export interface VillagerView {
  id: number;
  x: number;
  y: number;
}

export interface TickSnapshot {
  tick: number;
  villagers: VillagerView[];
}

export type Unlisten = () => void;
export type TickListener = (snapshot: TickSnapshot) => void;
