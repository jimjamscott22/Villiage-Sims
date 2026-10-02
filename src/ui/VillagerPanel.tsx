import { useState } from 'react';
import type { VillagerDetail } from '../state/types';
import { transport } from '../state/transport';
import { PixelText } from './PixelText';
import { SegmentedBar } from './SegmentedBar';

interface VillagerPanelProps {
  detail: VillagerDetail | null;
}

function formatHome(detail: VillagerDetail): string {
  if (detail.home == null) return 'none (sleeps where they stand)';
  const name = detail.homeBuilding ?? 'hut';
  return `${name} #${detail.home}`;
}

function formatWork(detail: VillagerDetail): string {
  if (!detail.jobKind) return 'none';
  const kind = detail.jobKind.replace(/_/g, ' ');
  // Gather jobs are sited at id 0 (the wilds), not a building — show no suffix.
  if (detail.jobSiteName && detail.jobSite != null) {
    return `${kind} @ ${detail.jobSiteName} #${detail.jobSite}`;
  }
  if (detail.jobSite != null && detail.jobSite !== 0) return `${kind} @ #${detail.jobSite}`;
  return kind;
}

export function VillagerPanel({ detail }: VillagerPanelProps) {
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeMsg, setHomeMsg] = useState<string | null>(null);

  const onClearHome = () => {
    if (!detail || detail.home == null || homeBusy) return;
    setHomeBusy(true);
    void transport
      .assignHome(detail.id, null)
      .then(() => setHomeMsg(null))
      .catch((cause) => setHomeMsg(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setHomeBusy(false));
  };

  return (
    <section className="border-t border-white/10 pt-3">
      <h2 className="text-[11px] text-white/50">
        <PixelText text="VILLAGER" />
      </h2>
      {!detail ? (
        <p className="mt-2 text-[11px] text-white/60">No villager selected.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <div className="font-medium text-white/90">{detail.name}</div>
            <div className="text-[11px] text-white/55">{detail.stateLabel}</div>
            {detail.thought && (
              <div className="mt-1 text-[11px] text-amber-300/90">"{detail.thought}"</div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <SegmentedBar label="Health" value={detail.health} />
            <SegmentedBar label="Hunger" value={detail.hunger} />
            <SegmentedBar label="Thirst" value={detail.thirst} />
            <SegmentedBar label="Energy" value={detail.energy} />
            <SegmentedBar label="Social" value={detail.social} />
            <SegmentedBar label="Happiness" value={detail.happiness} />
          </div>
          {detail.traits && detail.traits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {detail.traits.map((t) => (
                <span
                  key={t}
                  className="bg-emerald-950/80 px-1.5 py-0.5 text-[10px] text-emerald-300 border-2 border-emerald-800/60"
                >
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-white/50">
            Job: {formatWork(detail)}
          </p>
          <div className="text-[11px] text-white/50">
            <span>Home: {formatHome(detail)}</span>
            {detail.home != null && (
              <button
                type="button"
                disabled={homeBusy}
                onClick={onClearHome}
                title="Clear this villager's home assignment"
                className="pixel-btn pixel-focus ml-2 px-1.5 py-0.5 disabled:cursor-wait disabled:opacity-40"
              >
                Clear
              </button>
            )}
            {homeMsg && <span className="ml-2 text-red-300">{homeMsg}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
