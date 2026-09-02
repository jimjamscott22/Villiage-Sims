import type { VillagerDetail } from '../state/types';
import { PixelText } from './PixelText';
import { SegmentedBar } from './SegmentedBar';

interface VillagerPanelProps {
  detail: VillagerDetail | null;
}

export function VillagerPanel({ detail }: VillagerPanelProps) {
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
            <SegmentedBar label="Hunger" value={detail.hunger} />
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
