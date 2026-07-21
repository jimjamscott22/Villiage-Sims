import { useEffect, useState } from 'react';
import { Canvas } from './render/Canvas';
import { transport } from './state/transport';
import type { Catalog, ClockView, ResourceTotals, TickSnapshot, VillagerDetail } from './state/types';
import { BuildMenu } from './ui/BuildMenu';

const DETAIL_POLL_MS = 250;

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [resources, setResources] = useState<ResourceTotals | null>(null);
  const [clock, setClock] = useState<ClockView | null>(null);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [selectedCropKind, setSelectedCropKind] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [villagerDetail, setVillagerDetail] = useState<VillagerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void transport
      .getCatalog()
      .then(setCatalog)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void transport
        .getVillagerDetail(1)
        .then((detail) => {
          if (!cancelled) setVillagerDetail(detail);
        })
        .catch(() => {
          /* detail optional until sim ready */
        });
    };
    refresh();
    const timer = window.setInterval(refresh, DETAIL_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const onSnapshot = (snapshot: TickSnapshot) => {
    setResources(snapshot.resources);
    setClock(snapshot.clock);
  };

  const onDemolish = async () => {
    if (selectedBuildingId == null) return;
    try {
      await transport.demolish(selectedBuildingId);
      setSelectedBuildingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const onSetSpeed = async (speed: number) => {
    try {
      await transport.setSpeed(speed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <main className="flex h-full flex-col bg-[#17211b] text-[#f7f4e9]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <h1 className="text-base font-semibold">VillageSim</h1>
        <span className="text-xs text-white/60">
          {transport.mode === 'tauri' ? 'Simulation connected' : 'Browser demo'}
        </span>
      </header>
      {error && (
        <p role="alert" className="bg-red-950/90 px-4 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <Canvas
          catalog={catalog}
          selectedKind={selectedKind}
          selectedCropKind={selectedCropKind}
          rotation={rotation}
          selectedBuildingId={selectedBuildingId}
          onRotationChange={setRotation}
          onCancelBuild={() => {
            setSelectedKind(null);
            setSelectedCropKind(null);
          }}
          onSelectBuilding={setSelectedBuildingId}
          onSnapshot={onSnapshot}
        />
        <BuildMenu
          catalog={catalog}
          resources={resources}
          clock={clock}
          selectedKind={selectedKind}
          selectedCropKind={selectedCropKind}
          selectedBuildingId={selectedBuildingId}
          villagerDetail={villagerDetail}
          onSelectKind={(kind) => {
            setSelectedKind(kind);
            setSelectedCropKind(null);
            setSelectedBuildingId(null);
            setRotation(0);
          }}
          onSelectCropKind={(kind) => {
            setSelectedCropKind(kind);
            setSelectedKind(null);
            setSelectedBuildingId(null);
          }}
          onSetSpeed={(speed) => {
            void onSetSpeed(speed);
          }}
          onDemolish={() => {
            void onDemolish();
          }}
        />
      </div>
    </main>
  );
}
