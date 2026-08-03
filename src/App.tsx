import { useEffect, useState } from 'react';
import { Canvas } from './render/Canvas';
import { transport } from './state/transport';
import type {
  Catalog,
  ChronicleEntry,
  ClockView,
  ResourceTotals,
  TickSnapshot,
  VillagerDetail,
} from './state/types';
import { BuildMenu } from './ui/BuildMenu';
import { ChronicleDrawer } from './ui/ChronicleDrawer';
import { ClockBar } from './ui/ClockBar';
import { ResourceBar } from './ui/ResourceBar';

const DETAIL_POLL_MS = 250;

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [resources, setResources] = useState<ResourceTotals | null>(null);
  const [clock, setClock] = useState<ClockView | null>(null);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedVillagerId, setSelectedVillagerId] = useState<number | null>(1);
  const [villagerDetail, setVillagerDetail] = useState<VillagerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [worldKey, setWorldKey] = useState(0);
  const [persistenceBusy, setPersistenceBusy] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState('Slot 1 · Not saved this session');

  useEffect(() => {
    void transport
      .getCatalog()
      .then(setCatalog)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  useEffect(() => {
    if (selectedVillagerId == null) {
      setVillagerDetail(null);
      return;
    }
    let cancelled = false;
    const id = selectedVillagerId;
    const refresh = () => {
      void transport
        .getVillagerDetail(id)
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
  }, [selectedVillagerId]);

  const [population, setPopulation] = useState<number>(0);
  const [housingCapacity, setHousingCapacity] = useState<number>(0);
  const [chronicle, setChronicle] = useState<ChronicleEntry[]>([]);
  const [, setChronicleSeq] = useState(-1);
  const [chronicleCollapsed, setChronicleCollapsed] = useState(true);
  const [focusTile, setFocusTile] = useState<[number, number] | null>(null);
  const [unlocked, setUnlocked] = useState<string[]>([]);

  const onSnapshot = (snapshot: TickSnapshot) => {
    setResources(snapshot.resources);
    setClock(snapshot.clock);
    setPopulation(snapshot.villagers.length);
    setHousingCapacity(snapshot.housingCapacity ?? 0);
    setUnlocked(snapshot.unlocked ?? []);
    setChronicleSeq((previous) => {
      if (snapshot.chronicleSeq === previous) return previous;
      void transport
        .getChronicle()
        .then(setChronicle)
        .catch(() => {
          /* chronicle is best-effort; the next tick retries */
        });
      return snapshot.chronicleSeq;
    });
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

  const onSave = async () => {
    setPersistenceBusy(true);
    try {
      await transport.saveGame(1);
      setPersistenceStatus('Slot 1 · Saved');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPersistenceBusy(false);
    }
  };

  const onLoad = async () => {
    if (!window.confirm('Load Slot 1? Unsaved progress will be lost.')) return;
    setPersistenceBusy(true);
    try {
      await transport.loadGame(1);
      setSelectedKind(null);
      setSelectedCrop(null);
      setSelectedBuildingId(null);
      setRotation(0);
      setChronicle([]);
      setChronicleSeq(-1);
      setWorldKey((key) => key + 1);
      setPersistenceStatus('Slot 1 · Loaded');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPersistenceBusy(false);
    }
  };

  return (
    <main className="flex h-full flex-col bg-[#17211b] text-[#f7f4e9]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <h1 className="text-base font-semibold">VillageSim</h1>
        <ClockBar clock={clock} onSetSpeed={(speed) => { void onSetSpeed(speed); }} />
        <span className="text-xs text-white/60">
          {transport.mode === 'tauri' ? 'Simulation connected' : 'Browser demo'}
        </span>
      </header>
      <ResourceBar resources={resources} population={population} housingCapacity={housingCapacity} />
      {error && (
        <p role="alert" className="bg-red-950/90 px-4 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <Canvas
          key={worldKey}
          catalog={catalog}
          selectedKind={selectedKind}
          selectedCrop={selectedCrop}
          rotation={rotation}
          selectedBuildingId={selectedBuildingId}
          selectedVillagerId={selectedVillagerId}
          onRotationChange={setRotation}
          onCancelBuild={() => {
            setSelectedKind(null);
            setSelectedCrop(null);
          }}
          onSelectBuilding={setSelectedBuildingId}
          onSelectVillager={setSelectedVillagerId}
          onSnapshot={onSnapshot}
          focusTile={focusTile}
        />
        <BuildMenu
          catalog={catalog}
          selectedKind={selectedKind}
          selectedCrop={selectedCrop}
          selectedBuildingId={selectedBuildingId}
          villagerDetail={villagerDetail}
          unlocked={unlocked}
          persistenceStatus={persistenceStatus}
          persistenceBusy={persistenceBusy}
          onSelectKind={(kind) => {
            setSelectedKind(kind);
            setSelectedCrop(null);
            setSelectedBuildingId(null);
            setRotation(0);
          }}
          onSelectCrop={(kind) => {
            setSelectedCrop(kind);
            setSelectedKind(null);
            setSelectedBuildingId(null);
          }}
          onDemolish={() => {
            void onDemolish();
          }}
          onSave={() => {
            void onSave();
          }}
          onLoad={() => {
            void onLoad();
          }}
        />
      </div>
      <ChronicleDrawer
        entries={chronicle}
        catalog={catalog}
        collapsed={chronicleCollapsed}
        onToggle={() => setChronicleCollapsed((value) => !value)}
        onFocus={(tile) => setFocusTile(tile)}
      />
    </main>
  );
}
