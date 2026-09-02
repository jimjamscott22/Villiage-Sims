import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from './render/Canvas';
import { formatEntry } from './state/chronicle';
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
import { FloatingText, type Floater } from './ui/FloatingText';
import { ObjectivesPanel } from './ui/ObjectivesPanel';
import { ToastStack, type Toast } from './ui/ToastStack';

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
          // Villager may have died or the world was replaced by a load.
          if (!cancelled) {
            setSelectedVillagerId(null);
            setVillagerDetail(null);
          }
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
  const pushFloater = (text: string, color: string) => {
    const id = ++floaterIdRef.current;
    setFloaters((prev) => [...prev, { id, text, color }]);
  };
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [winterWarning, setWinterWarning] = useState(false);
  const [completedObjectives, setCompletedObjectives] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeqRef = useRef(-1);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floaterIdRef = useRef(0);
  const lastResourcesRef = useRef<ResourceTotals | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);
  const dismissFloater = useCallback((id: number) => {
    setFloaters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const onSnapshot = (snapshot: TickSnapshot) => {
    const previous = lastResourcesRef.current;
    if (previous) {
      const deltas = [
        { key: 'wood', label: 'wood', value: snapshot.resources.wood - previous.wood, color: '#d4a85a' },
        { key: 'stone', label: 'stone', value: snapshot.resources.stone - previous.stone, color: '#a8b0b5' },
        { key: 'grain', label: 'grain', value: snapshot.resources.grain - previous.grain, color: '#e6c84a' },
        { key: 'flour', label: 'flour', value: snapshot.resources.flour - previous.flour, color: '#f4e8d0' },
        { key: 'food', label: 'food', value: snapshot.resources.food - previous.food, color: '#b6f28a' },
        { key: 'gold', label: 'gold', value: snapshot.resources.gold - previous.gold, color: '#ffd700' },
      ] as const;
      for (const delta of deltas) {
        if (delta.value > 0) {
          pushFloater(`+${delta.value} ${delta.label}`, delta.color);
        }
      }
    }
    lastResourcesRef.current = snapshot.resources;

    setResources(snapshot.resources);
    setClock(snapshot.clock);
    setPopulation(snapshot.villagers.length);
    setHousingCapacity(snapshot.housingCapacity ?? 0);
    setUnlocked(snapshot.unlocked ?? []);
    setWinterWarning(snapshot.winterWarning ?? false);
    setCompletedObjectives(snapshot.completedObjectives ?? []);
    setSelectedVillagerId((current) => {
      if (current == null) return current;
      return snapshot.villagers.some((villager) => villager.id === current) ? current : null;
    });
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

          // Toast new important chronicle entries. The first fetch after a
          // load/new world seeds toastSeqRef so we don't replay history.
          const newEntries = entries.filter((entry) => entry.seq > toastSeqRef.current);
          if (toastSeqRef.current !== -1) {
            const toastable = newEntries.filter(
              (entry) =>
                entry.body.kind === 'villagerBorn' ||
                entry.body.kind === 'villagerDied' ||
                entry.body.kind === 'buildingComplete',
            );
            if (toastable.length > 0) {
              setToasts((prev) => [
                ...prev,
                ...toastable.map((entry) => ({
                  id: entry.seq,
                  kind: entry.body.kind,
                  message: formatEntry(entry, catalog),
                  tile: entry.focus,
                })),
              ]);
            }

            for (const entry of newEntries) {
              if (entry.body.kind === 'buildingComplete') {
                pushFloater('Building complete!', '#f4c95d');
              } else if (entry.body.kind === 'harvestReady') {
                pushFloater(`${entry.body.count} crop${entry.body.count === 1 ? '' : 's'} ready`, '#b6f28a');
              }
            }
          }
          toastSeqRef.current = Math.max(
            toastSeqRef.current,
            ...entries.map((entry) => entry.seq),
          );

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
      setSelectedVillagerId(null);
      setVillagerDetail(null);
      setRotation(0);
      setChronicle([]);
      setToasts([]);
      setFloaters([]);
      setWinterWarning(false);
      setCompletedObjectives([]);
      chronicleSeqRef.current = -1;
      toastSeqRef.current = -1;
      lastResourcesRef.current = null;
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
      <header className="pixel-panel relative z-20 grid h-12 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-4">
        <h1 className="text-base border-r border-white/10 pr-4">
          <PixelText text="VILLAGESIM" />
        </h1>
        <div className="flex justify-center overflow-hidden">
          <ClockBar
            clock={clock}
            onSetSpeed={(speed) => { void onSetSpeed(speed); }}
            winterWarning={winterWarning}
          />
        </div>
        <div className="flex min-w-0 items-center gap-2 justify-self-end">
          <ObjectivesPanel catalog={catalog} completed={completedObjectives} />
          <button
            type="button"
            data-testid="save-game"
            disabled={persistenceBusy}
            title={persistenceStatus}
            onClick={() => {
              void onSave();
            }}
            className="pixel-btn pixel-focus px-2 py-1 disabled:cursor-wait disabled:opacity-40"
          >
            <PixelText text="SAVE" />
          </button>
          <button
            type="button"
            data-testid="load-game"
            disabled={persistenceBusy}
            title={persistenceStatus}
            onClick={() => {
              void onLoad();
            }}
            className="pixel-btn pixel-focus px-2 py-1 disabled:cursor-wait disabled:opacity-40"
          >
            <PixelText text="LOAD" />
          </button>
          <span className="border-l border-white/10 pl-3 text-xs text-white/60">
            {transport.mode === 'tauri' ? 'Simulation connected' : 'Browser demo'}
          </span>
        </div>
      </header>
      <ResourceBar resources={resources} population={population} housingCapacity={housingCapacity} />
      {error && (
        <p role="alert" className="border-y-2 border-red-500/50 bg-red-950/90 px-4 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 flex-1">
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
          <ToastStack
            toasts={toasts}
            onDismiss={dismissToast}
            onFocus={(tile) =>
              setFocusTile((previous) => ({ tile, nonce: (previous?.nonce ?? 0) + 1 }))
            }
          />
          <FloatingText floaters={floaters} onDismiss={dismissFloater} />
        </div>
        <div className="flex min-h-0 w-56 shrink-0 flex-col">
          <BuildMenu
            catalog={catalog}
            selectedKind={selectedKind}
            selectedCrop={selectedCrop}
            selectedBuildingId={selectedBuildingId}
            villagerDetail={villagerDetail}
            unlocked={unlocked}
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
          />
        </div>
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
