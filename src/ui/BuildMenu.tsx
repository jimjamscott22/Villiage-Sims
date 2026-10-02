import { CHICKEN_DEMOLITION_WARNING } from './chickenDemolition';
import { useState } from 'react';
import type { BuildingDef, Catalog, CropDef, VillagerDetail } from '../state/types';
import { transport } from '../state/transport';
import { AtlasThumb } from './AtlasThumb';
import { PixelText } from './PixelText';
import { uiIconStyle } from './pixelUi';
import { VillagerPanel } from './VillagerPanel';

interface BuildMenuProps {
  chickenShelterId?: number | null;
  catalog: Catalog | null;
  selectedKind: string | null;
  selectedCrop: string | null;
  selectedBuildingId: number | null;
  villagerDetail: VillagerDetail | null;
  unlocked: string[];
  onSelectKind: (kind: string | null) => void;
  onSelectCrop: (kind: string | null) => void;
  onDemolish: () => void;
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

export function nextSelection(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

export function BuildMenu({
  chickenShelterId = null,
  catalog,
  selectedKind,
  selectedCrop,
  selectedBuildingId,
  villagerDetail,
  unlocked,
  onSelectKind,
  onSelectCrop,
  onDemolish,
}: BuildMenuProps) {
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeMsg, setHomeMsg] = useState<string | null>(null);
  // The snapshot building list isn't plumbed into this menu, so housing-ness
  // can't be checked up front: the button shows whenever a building and a
  // villager are both selected, and the sim rejects non-residences (or full
  // huts) with a readable error below.
  const canAssignHome = villagerDetail != null && selectedBuildingId != null;

  const onAssignHome = () => {
    if (villagerDetail == null || selectedBuildingId == null || homeBusy) return;
    setHomeBusy(true);
    void transport
      .assignHome(villagerDetail.id, selectedBuildingId)
      .then(() => setHomeMsg(`Home set to building #${selectedBuildingId}`))
      .catch((cause) => setHomeMsg(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setHomeBusy(false));
  };
  return (
    <aside className="pixel-panel flex min-h-0 flex-1 flex-col overflow-hidden p-3 text-sm">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <VillagerPanel detail={villagerDetail} />

        <div>
          <h2 className="text-[11px] text-white/50">
            <PixelText text="PLANT" />
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {(catalog?.crops ?? []).map((crop: CropDef) => {
              const active = selectedCrop === crop.id;
              return (
                <li key={crop.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCrop(nextSelection(selectedCrop, crop.id))}
                    className={`pixel-btn pixel-focus w-full px-2 py-2 text-left transition ${
                      active ? 'pixel-btn-active' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AtlasThumb cellKey={`${crop.id}.${crop.stages - 1}`} scale={1} />
                      <div>
                        <div className="font-medium text-white/90">{crop.name}</div>
                        <div className="text-[11px] text-white/55">
                          {crop.seasons.join(', ')} · {crop.stages} stages
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h2 className="text-[11px] text-white/50">
            <PixelText text="BUILD" />
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {(catalog?.buildings ?? []).map((building: BuildingDef) => {
              const active = selectedKind === building.id;
              const locked = !unlocked.includes(building.id) || (building.id === 'chicken_shelter' && chickenShelterId != null);
              const spriteKey = building.sprite ?? building.id;

              return (
                <li key={building.id}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onSelectKind(nextSelection(selectedKind, building.id))}
                    className={`pixel-btn pixel-focus relative w-full px-2 py-2 text-left transition ${
                      locked
                        ? 'cursor-not-allowed opacity-60'
                        : active
                          ? 'pixel-btn-active'
                          : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="relative shrink-0">
                        <AtlasThumb cellKey={spriteKey} scale={1} desaturate={locked} />
                        {locked && (
                          <span
                            className="absolute -right-1 -top-1 pixel-icon"
                            style={uiIconStyle('ui.icon.lock', 1)}
                            title="Locked"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 font-medium text-white/90">
                          <span>{building.name}</span>
                          {locked && (
                            <span className="text-[10px] font-normal text-amber-400">
                              {building.unlockConditions?.minPopulation != null
                                ? `Pop ${building.unlockConditions.minPopulation}+`
                                : 'Locked'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/55">
                          {formatCost(building.cost)}
                          {building.id === 'chicken_shelter' && <span className="block text-amber-100/80">{chickenShelterId != null ? 'One shelter already placed' : '3 named chickens · optional eggs'}</span>}
                          {formatRecipe(building)}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-white/70">
            Select a building or crop, then click the map. <kbd className="text-[#f7f4e9]">R</kbd> rotates,{' '}
            <kbd className="text-[#f7f4e9]">Esc</kbd> cancels. Middle-drag pans. Right-click to move.
          </p>
        </div>
      </div>

      <div className="shrink-0 pt-2">
        {selectedBuildingId != null && selectedBuildingId === chickenShelterId && (
          <p className="mb-2 text-[11px] leading-relaxed text-amber-200">{CHICKEN_DEMOLITION_WARNING}</p>
        )}
        {canAssignHome && (
          <div className="mb-2">
            <button
              type="button"
              disabled={homeBusy}
              onClick={onAssignHome}
              title="Assign the selected building as this villager's home"
              className="pixel-btn pixel-focus w-full bg-emerald-950/60 px-2 py-2 text-xs text-emerald-100 disabled:cursor-wait disabled:opacity-40"
            >
              Assign home ({villagerDetail?.name} → #{selectedBuildingId})
            </button>
            {homeMsg && <p className="mt-1 text-[11px] text-white/60">{homeMsg}</p>}
          </div>
        )}
        <button
          type="button"
          disabled={selectedBuildingId == null}
          onClick={onDemolish}
          className="pixel-btn pixel-focus w-full bg-red-950/60 px-2 py-2 text-xs text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Demolish selected
        </button>
      </div>
    </aside>
  );
}
