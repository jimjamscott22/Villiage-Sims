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
  /** 0 Idle, 1 Moving, 2 Working, 3 Eating, 4 Sleeping, 5 Socializing. */
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

export interface CropView {
  id: number;
  x: number;
  y: number;
  kind: number;
  stage: number;
}

export interface ClockView {
  minute: number;
  day: number;
  season: number;
  year: number;
  speed: number;
}

export type SimEvent = { kind: 'cropReady'; id: number };

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
  crops: CropView[];
  resources: ResourceTotals;
  clock: ClockView;
  events: SimEvent[];
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

export interface CropDef {
  id: string;
  name: string;
  stages: number;
  ticksPerStage: number;
  seasons: string[];
  waterRequired: boolean;
  yield?: Record<string, number>;
  seedCost?: Record<string, number>;
}

export interface Catalog {
  buildings: BuildingDef[];
  crops: CropDef[];
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

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
