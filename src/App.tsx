import { useEffect, useState } from 'react';
import { Canvas } from './render/Canvas';
import { transport } from './state/transport';
import type { Catalog, ResourceTotals, TickSnapshot } from './state/types';
import { BuildMenu } from './ui/BuildMenu';

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [resources, setResources] = useState<ResourceTotals | null>(null);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void transport
      .getCatalog()
      .then(setCatalog)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  const onSnapshot = (snapshot: TickSnapshot) => {
    setResources(snapshot.resources);
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
          rotation={rotation}
          selectedBuildingId={selectedBuildingId}
          onRotationChange={setRotation}
          onCancelBuild={() => setSelectedKind(null)}
          onSelectBuilding={setSelectedBuildingId}
          onSnapshot={onSnapshot}
        />
        <BuildMenu
          catalog={catalog}
          resources={resources}
          selectedKind={selectedKind}
          selectedBuildingId={selectedBuildingId}
          onSelectKind={(kind) => {
            setSelectedKind(kind);
            setSelectedBuildingId(null);
            setRotation(0);
          }}
          onDemolish={() => {
            void onDemolish();
          }}
        />
      </div>
    </main>
  );
}
