import { useEffect, useRef, useState } from 'react';
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
import { PixelText } from './ui/PixelText';
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
  // Sentinel ref, not state: nothing reads the seq itself, it only gates
  // whether a refetch is needed. A ref keeps the comparison a pure read
  // inside the snapshot handler instead of a side effect inside a state
  // updater (React 18 double-invokes updaters under StrictMode).
  const chronicleSeqRef = useRef(-1);
  // Guards against an in-flight getChronicle() response overwriting a newer
  // one if two requests are outstanding at once and resolve out of order.
  const chronicleRequestRef = useRef(0);
  const [chronicleCollapsed, setChronicleCollapsed] = useState(true);
  const [focusTile, setFocusTile] = useState<{ tile: [number, number]; nonce: number } | null>(
    null,
  );
  const [unlocked, setUnlocked] = useState<string[]>([]);

  const onSnapshot = (snapshot: TickSnapshot) => {
    setResources(snapshot.resources);
    setClock(snapshot.clock);
    setPopulation(snapshot.villagers.length);
    setHousingCapacity(snapshot.housingCapacity ?? 0);
    setUnlocked(snapshot.unlocked ?? []);
    if (snapshot.lastAutosaveSlot != null) {
      setPersistenceStatus(`Autosaved · Slot ${snapshot.lastAutosaveSlot}`);
    }
    if (snapshot.chronicleSeq !== chronicleSeqRef.current) {
      const requestId = ++chronicleRequestRef.current;
      void transport
        .getChronicle()
        .then((entries) => {
          if (chronicleRequestRef.current !== requestId) return; // superseded by a newer fetch
          chronicleSeqRef.current = snapshot.chronicleSeq;
          setChronicle(entries);
        })
        .catch(() => {
          // Chronicle is best-effort; leave the ref stale so the next seq
          // change (or even a retry at the same seq) retries the fetch.
        });
    }
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
      chronicleSeqRef.current = -1;
      chronicleRequestRef.current += 1; // invalidate any in-flight fetch from the old world
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
      <header className="pixel-panel flex h-12 shrink-0 items-center justify-between px-4">
        <h1 className="text-base">
          <PixelText text="VILLAGESIM" />
        </h1>
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
        onFocus={(tile) =>
          setFocusTile((previous) => ({ tile, nonce: (previous?.nonce ?? 0) + 1 }))
        }
      />
    </main>
  );
}
