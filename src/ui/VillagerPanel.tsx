import type { VillagerDetail } from '../state/types';

interface VillagerPanelProps {
  detail: VillagerDetail | null;
}

function NeedBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[11px] text-white/60">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-white/10">
        <div className="h-full rounded-sm bg-emerald-600/90" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function VillagerPanel({ detail }: VillagerPanelProps) {
  return (
    <section className="border-t border-white/10 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">Villager</h2>
      {!detail ? (
        <p className="mt-2 text-[11px] text-white/45">No villager selected.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <div className="font-medium text-white/90">{detail.name}</div>
            <div className="text-[11px] text-white/55">{detail.stateLabel}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <NeedBar label="Hunger" value={detail.hunger} />
            <NeedBar label="Energy" value={detail.energy} />
            <NeedBar label="Social" value={detail.social} />
            <NeedBar label="Happiness" value={detail.happiness} />
          </div>
          <p className="text-[11px] text-white/50">
            Job:{' '}
            {detail.jobKind
              ? `${detail.jobKind.replace(/_/g, ' ')}${detail.jobSite != null ? ` @ #${detail.jobSite}` : ''}`
              : 'none'}
          </p>
        </div>
      )}
    </section>
  );
}
