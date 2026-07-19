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
  /** 0 = Idle, 1 = Moving, 2 = Working (M5 FSM). */
  state?: number;
}

export interface VillagerDetail {
  id: number;
  name: string;
  state: number;
  stateLabel: string;
  hunger: number;
  energy: number;
  social: number;
  happiness: number;
  jobKind: string | null;
  jobSite: number | null;
}

export interface BuildingView {
  id: number;
  kind: number;
  x: number;
  y: number;
  rot: number;
  state: number;
  progress: number;
}

export interface ResourceTotals {
  wood: number;
  stone: number;
  grain: number;
  food: number;
  gold: number;
}

export interface TickSnapshot {
  tick: number;
  villagers: VillagerView[];
  buildings: BuildingView[];
  resources: ResourceTotals;
}

export interface BuildingDef {
  id: string;
  name: string;
  footprint: [number, number];
  cost: Record<string, number>;
  buildTicks: number;
  category: string;
  houses?: number;
  validTerrain: string[];
  jobs?: { kind: string; slots: number }[];
  stores?: string[];
  capacity?: number;
}

export interface Catalog {
  buildings: BuildingDef[];
}

export interface PlacementValidity {
  valid: boolean;
  reason: string;
}

export interface PlacementResult {
  id: number;
}

export type Unlisten = () => void;
export type TickListener = (snapshot: TickSnapshot) => void;
