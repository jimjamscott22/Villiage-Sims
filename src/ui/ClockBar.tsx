import type { ClockView } from '../state/types';
import { SEASON_NAMES } from '../state/types';

interface ClockBarProps {
  clock: ClockView | null;
  onSetSpeed: (speed: number) => void;
}

const SPEEDS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Pause' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];

export function ClockBar({ clock, onSetSpeed }: ClockBarProps) {
  const season = clock ? SEASON_NAMES[clock.season] ?? 'Spring' : '—';
  return (
    <div className="flex items-center gap-3 text-xs text-white/80">
      <span className="tabular-nums">
        Day {clock?.day ?? '—'} · {season} · Year {clock?.year ?? '—'}
      </span>
      <div className="flex gap-1">
        {SPEEDS.map((entry) => {
          const active = clock?.speed === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              onClick={() => onSetSpeed(entry.value)}
              className={`rounded px-2 py-1 transition ${
                active ? 'bg-emerald-800/80 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
