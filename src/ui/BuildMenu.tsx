import type { BuildingDef, Catalog, CropDef, VillagerDetail } from '../state/types';
import { VillagerPanel } from './VillagerPanel';

interface BuildMenuProps {
  catalog: Catalog | null;
  selectedKind: string | null;
  selectedCrop: string | null;
  selectedBuildingId: number | null;
  villagerDetail: VillagerDetail | null;
  unlocked: string[];
  persistenceStatus: string;
  persistenceBusy: boolean;
  onSelectKind: (kind: string | null) => void;
  onSelectCrop: (kind: string | null) => void;
  onDemolish: () => void;
  onSave: () => void;
  onLoad: () => void;
}

function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([key, amount]) => `${amount} ${key}`)
    .join(', ');
}

function formatRecipe(building: BuildingDef): string {
  if (!building.recipe) return '';
  const inputs = Object.keys(building.recipe.inputs).join('+');
  const outputs = Object.keys(building.recipe.outputs).join('+');
  return ` · ${inputs}→${outputs}`;
}

export function BuildMenu({
  catalog,
  selectedKind,
  selectedCrop,
  selectedBuildingId,
  villagerDetail,
  unlocked,
  persistenceStatus,
  persistenceBusy,
  onSelectKind,
  onSelectCrop,
  onDemolish,
  onSave,
  onLoad,
}: BuildMenuProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3 border-l border-white/10 bg-[#121c18] p-3 text-sm">
      <VillagerPanel detail={villagerDetail} />

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Plant</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {(catalog?.crops ?? []).map((crop: CropDef) => {
            const active = selectedCrop === crop.id;
            return (
              <li key={crop.id}>
                <button
                  type="button"
                  onClick={() => onSelectCrop(active ? null : crop.id)}
                  className={`w-full rounded px-2 py-2 text-left transition ${
                    active ? 'bg-lime-800/70 text-white' : 'bg-white/5 text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium">{crop.name}</div>
                  <div className="text-[11px] text-white/55">
                    {crop.seasons.join(', ')} · {crop.stages} stages
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-h-0 flex-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Build</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {(catalog?.buildings ?? []).map((building: BuildingDef) => {
            const active = selectedKind === building.id;
            const locked = !unlocked.includes(building.id);

            return (
              <li key={building.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSelectKind(active ? null : building.id)}
                  className={`w-full rounded px-2 py-2 text-left transition ${
                    locked
                      ? 'opacity-40 cursor-not-allowed bg-white/5 text-white/40'
                      : active
                        ? 'bg-emerald-800/70 text-white'
                        : 'bg-white/5 text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center font-medium">
                    <span>{building.name}</span>
                    {locked && (
                      <span className="text-[10px] text-amber-400 font-normal">
                        🔒 {building.unlockConditions?.minPopulation != null
                          ? `Pop ${building.unlockConditions.minPopulation}+`
                          : 'Locked'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/55">
                    {formatCost(building.cost)}
                    {formatRecipe(building)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          Select a building or crop, then click the map. <kbd className="text-white/70">R</kbd> rotates,{' '}
          <kbd className="text-white/70">Esc</kbd> cancels. Middle-drag pans. Right-click to move.
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Game</h2>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <button
            type="button"
            disabled={persistenceBusy}
            onClick={onSave}
            className="rounded bg-emerald-900/70 px-2 py-2 text-xs text-emerald-50 transition hover:bg-emerald-800/80 disabled:cursor-wait disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={persistenceBusy}
            onClick={onLoad}
            className="rounded bg-white/5 px-2 py-2 text-xs text-white/85 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-40"
          >
            Load
          </button>
        </div>
        <p className="mt-1 text-[11px] text-white/45">{persistenceStatus}</p>
      </div>

      <div>
        <button
          type="button"
          disabled={selectedBuildingId == null}
          onClick={onDemolish}
          className="w-full rounded bg-red-950/80 px-2 py-2 text-xs text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Demolish selected
        </button>
      </div>
    </aside>
  );
}
