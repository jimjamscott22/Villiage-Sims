import type { BuildingDef, Catalog, ClockView, CropDef, ResourceTotals, VillagerDetail } from '../state/types';
import { SEASON_NAMES } from '../state/types';
import { VillagerPanel } from './VillagerPanel';

interface BuildMenuProps {
  catalog: Catalog | null;
  resources: ResourceTotals | null;
  clock: ClockView | null;
  selectedKind: string | null;
  selectedCropKind: string | null;
  selectedBuildingId: number | null;
  villagerDetail: VillagerDetail | null;
  onSelectKind: (kind: string | null) => void;
  onSelectCropKind: (kind: string | null) => void;
  onSetSpeed: (speed: number) => void;
  onDemolish: () => void;
}

function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([key, amount]) => `${amount} ${key}`)
    .join(', ');
}

const SPEED_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Pause' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];

export function BuildMenu({
  catalog,
  resources,
  clock,
  selectedKind,
  selectedCropKind,
  selectedBuildingId,
  villagerDetail,
  onSelectKind,
  onSelectCropKind,
  onSetSpeed,
  onDemolish,
}: BuildMenuProps) {
  const seasonLabel = clock ? SEASON_NAMES[clock.season] ?? '—' : '—';
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3 border-l border-white/10 bg-[#121c18] p-3 text-sm">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Clock</h2>
        <p className="mt-1 text-xs text-white/80">
          {seasonLabel} · Day {clock?.day ?? '—'} · Year {clock?.year ?? '—'}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {SPEED_OPTIONS.map((option) => {
            const active = (clock?.speed ?? 1) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSetSpeed(option.value)}
                className={`rounded px-1 py-1 text-[11px] ${
                  active ? 'bg-emerald-800/70 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Resources</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-white/80">
          <dt>Wood</dt>
          <dd className="text-right tabular-nums">{resources?.wood ?? '—'}</dd>
          <dt>Stone</dt>
          <dd className="text-right tabular-nums">{resources?.stone ?? '—'}</dd>
        </dl>
      </div>

      <VillagerPanel detail={villagerDetail} />

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Plant</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {(catalog?.crops ?? []).map((crop: CropDef) => {
            const active = selectedCropKind === crop.id;
            return (
              <li key={crop.id}>
                <button
                  type="button"
                  onClick={() => onSelectCropKind(active ? null : crop.id)}
                  className={`w-full rounded px-2 py-2 text-left transition ${
                    active ? 'bg-lime-900/70 text-white' : 'bg-white/5 text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium">{crop.name}</div>
                  <div className="text-[11px] text-white/55">{crop.stages} stages</div>
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
            return (
              <li key={building.id}>
                <button
                  type="button"
                  onClick={() => onSelectKind(active ? null : building.id)}
                  className={`w-full rounded px-2 py-2 text-left transition ${
                    active ? 'bg-emerald-800/70 text-white' : 'bg-white/5 text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium">{building.name}</div>
                  <div className="text-[11px] text-white/55">{formatCost(building.cost)}</div>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">
          Select a building or crop, then click the map. <kbd className="text-white/70">R</kbd> rotates
          buildings, <kbd className="text-white/70">Esc</kbd> cancels. Right-click to move.
        </p>
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
