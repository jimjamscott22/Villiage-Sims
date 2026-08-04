import type { ClockView } from '../state/types';
import { SEASON_NAMES, WEATHER_NAMES } from '../state/types';
import { PixelText } from './PixelText';
import { uiIconStyle } from './pixelUi';

interface ClockBarProps {
  clock: ClockView | null;
  onSetSpeed: (speed: number) => void;
}

const SPEEDS: Array<{ value: number; icon: string; label: string }> = [
  { value: 0, icon: 'ui.icon.pause', label: 'Pause' },
  { value: 1, icon: 'ui.icon.speed1', label: '1x' },
  { value: 2, icon: 'ui.icon.speed2', label: '2x' },
  { value: 3, icon: 'ui.icon.speed3', label: '3x' },
];

const SEASON_ICONS = ['ui.icon.spring', 'ui.icon.summer', 'ui.icon.autumn', 'ui.icon.winter'] as const;

export function ClockBar({ clock, onSetSpeed }: ClockBarProps) {
  const season = clock ? (SEASON_NAMES[clock.season] ?? 'Spring') : '—';
  const seasonIcon = clock != null ? SEASON_ICONS[clock.season] ?? SEASON_ICONS[0] : SEASON_ICONS[0];
  const weather =
    clock != null ? (WEATHER_NAMES[clock.weather] ?? WEATHER_NAMES[0]) : '—';
  const clockText =
    clock != null
      ? `DAY ${clock.day} ${season.toUpperCase()} Y${clock.year}`
      : 'DAY - SPRING Y-';

  return (
    <div className="flex items-center gap-3 text-xs text-white/80">
      <span className="pixel-icon" style={uiIconStyle(seasonIcon)} title={season} />
      <PixelText text={clockText} />
      <span className="text-white/55" title="Weather">
        <PixelText text={weather.toUpperCase()} />
      </span>
      <div className="flex gap-1">
        {SPEEDS.map((entry) => {
          const active = clock?.speed === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              title={entry.label}
              onClick={() => onSetSpeed(entry.value)}
              className={`pixel-btn pixel-focus flex items-center justify-center p-0.5 transition ${
                active ? 'pixel-btn-active' : ''
              }`}
            >
              <span className="pixel-icon" style={uiIconStyle(entry.icon)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
