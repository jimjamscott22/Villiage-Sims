import { useMemo, useState } from 'react';
import {
  lowestNeed,
  ROSTER_STATS,
  sortRoster,
  statTone,
  type RosterSortKey,
  type StatTone,
} from '../state/roster';
import type { VillagerDetail } from '../state/types';
import { PixelText } from './PixelText';

interface VillagerRosterProps {
  roster: VillagerDetail[] | null;
  selectedVillagerId: number | null;
  showNameTags: boolean;
  onToggleNameTags: () => void;
  onSelect: (detail: VillagerDetail) => void;
  onClose: () => void;
}

const TONE_FILL: Record<StatTone, string> = {
  critical: 'bg-red-500',
  low: 'bg-amber-400',
  ok: 'bg-emerald-400',
};

function StatCell({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone = statTone(value);
  return (
    <td className="px-1.5 py-1">
      <div
        className="flex items-center gap-1"
        role="meter"
        aria-label={`${label} ${pct}%`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-1.5 w-10 shrink-0 bg-white/10">
          <div className={`h-full ${TONE_FILL[tone]}`} style={{ width: `${pct}%` }} />
        </div>
        <span
          className={`w-7 text-right tabular-nums ${
            tone === 'critical' ? 'text-red-300' : tone === 'low' ? 'text-amber-200' : 'text-white/70'
          }`}
        >
          {pct}
        </span>
      </div>
    </td>
  );
}

export function VillagerRoster({
  roster,
  selectedVillagerId,
  showNameTags,
  onToggleNameTags,
  onSelect,
  onClose,
}: VillagerRosterProps) {
  const [sort, setSort] = useState<{ key: RosterSortKey; descending: boolean }>({
    key: 'name',
    descending: false,
  });
  const rows = useMemo(
    () => (roster ? sortRoster(roster, sort.key, sort.descending) : []),
    [roster, sort],
  );
  const needAttention = rows.filter((detail) => statTone(lowestNeed(detail).value) === 'critical').length;

  const toggleSort = (key: RosterSortKey) =>
    setSort((current) =>
      current.key === key ? { key, descending: !current.descending } : { key, descending: false },
    );
  const sortMark = (key: RosterSortKey) => (sort.key === key ? (sort.descending ? ' ▾' : ' ▴') : '');

  return (
    <section
      className="pixel-panel absolute left-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[min(34rem,calc(100%-1.5rem))] flex-col text-xs text-white/80"
      data-testid="villager-roster"
      aria-label="Villager roster"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <h2 className="text-[11px] text-white/60">
          <PixelText text="VILLAGERS" />
        </h2>
        <span className="text-white/60">
          {roster ? `${roster.length} living` : 'Loading…'}
          {needAttention > 0 && (
            <span className="ml-2 text-red-300">· {needAttention} need attention</span>
          )}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1 text-white/70">
          <input
            type="checkbox"
            checked={showNameTags}
            onChange={onToggleNameTags}
            data-testid="roster-name-tags"
          />
          Name tags
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close villager roster"
          className="pixel-btn pixel-focus px-1.5 py-0.5"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#1c2a21] text-left text-[10px] uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-3 py-1">
                <button type="button" className="pixel-focus" onClick={() => toggleSort('name')}>
                  Name{sortMark('name')}
                </button>
              </th>
              {ROSTER_STATS.map((stat) => (
                <th key={stat.key} className="px-1.5 py-1" title={`Sort by ${stat.label.toLowerCase()}`}>
                  <button type="button" className="pixel-focus" onClick={() => toggleSort(stat.key)}>
                    {stat.label}
                    {sortMark(stat.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((detail) => {
              const selected = detail.id === selectedVillagerId;
              const worst = lowestNeed(detail);
              return (
                <tr
                  key={detail.id}
                  data-testid="roster-row"
                  onClick={() => onSelect(detail)}
                  aria-selected={selected}
                  className={`cursor-pointer border-t border-white/5 ${
                    selected ? 'bg-amber-900/40' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="max-w-[11rem] px-3 py-1">
                    <div className="flex items-center gap-1 font-medium text-white/90">
                      <span className="truncate">{detail.name}</span>
                      <span className="shrink-0 text-[10px] font-normal text-white/35">#{detail.id}</span>
                      {statTone(worst.value) === 'critical' && (
                        <span className="shrink-0 text-red-300" title={`${worst.label} is critical`}>
                          !
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[10px] text-white/50">{detail.stateLabel}</div>
                  </td>
                  {ROSTER_STATS.map((stat) => (
                    <StatCell key={stat.key} label={stat.label} value={detail[stat.key]} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {roster && roster.length === 0 && (
          <p className="px-3 py-3 text-white/50">No villagers are alive.</p>
        )}
      </div>
    </section>
  );
}
