export interface TerrainSnapshot {
  width: number;
  height: number;
  tileSize: number;
  tiles: number[];
}

export interface WorldInit {
  seed: number;
  width: number;
  height: number;
  tileSize: number;
  tick: number;
  saveVersion: number;
}

export interface VillagerView {
  id: number;
  x: number;
  y: number;
  /** 0 Idle, 1 Moving, 2 Working, 3 Eating, 4 Sleeping, 5 Socializing. */
  state?: number;
  /** Position delta vs previous snapshot — used for facing. Absent when unknown. */
  dx?: number;
  dy?: number;
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
  traits: string[];
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
  /** 0 Clear, 1 Rain, 2 Storm. */
  weather: number;
}

export type ChronicleBody =
  | { kind: 'villagerBorn'; id: number; name: string }
  | { kind: 'villagerDied'; id: number; name: string; cause: string }
  | { kind: 'buildingComplete'; id: number; building: string }
  | { kind: 'buildingUnlocked'; building: string }
  | { kind: 'harvestReady'; site: number; building: string | null; count: number }
  | { kind: 'seasonTurned'; season: number; year: number };

export interface ChronicleEntry {
  seq: number;
  tick: number;
  day: number;
  season: number;
  year: number;
  focus: [number, number] | null;
  body: ChronicleBody;
}

export interface ResourceTotals {
  wood: number;
  stone: number;
  grain: number;
  flour: number;
  food: number;
  gold: number;
}

export interface TickSnapshot {
  tick: number;
  villagers: VillagerView[];
  buildings: BuildingView[];
  crops: CropView[];
  resources: ResourceTotals;
  housingCapacity: number;
  clock: ClockView;
  chronicleSeq: number;
  unlocked: string[];
  lastAutosaveSlot?: number | null;
}

export interface RecipeDef {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  ticks: number;
}

export interface UnlockCondition {
  minPopulation?: number;
  requiresBuilding?: string;
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
  recipe?: RecipeDef;
  unlockConditions?: UnlockCondition;
  /** Optional atlas key; falls back to `id` when omitted. */
  sprite?: string;
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
  /** Optional atlas key; falls back to `id` when omitted. */
  sprite?: string;
}

export interface TraitDef {
  id: string;
  name: string;
  description: string;
}

export interface Catalog {
  buildings: BuildingDef[];
  crops: CropDef[];
  traits?: TraitDef[];
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
export const WEATHER_NAMES = ['Clear', 'Rain', 'Storm'] as const;
