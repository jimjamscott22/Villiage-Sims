import { barNotchVars } from './pixelUi';

interface SegmentedBarProps {
  label: string;
  value: number;
  segments?: number;
}

const NOTCH_W = 8;
const NOTCH_H = 12;

export function SegmentedBar({ label, value, segments = 10 }: SegmentedBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * segments);
  const pct = Math.round(clamped * 100);
  const notchVars = barNotchVars();

  return (
    <div className="flex flex-col gap-0.5" style={notchVars}>
      <div className="flex justify-between text-[11px] text-white/60">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="flex gap-px"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${pct}%`}
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className="inline-block shrink-0 bg-no-repeat"
            style={{
              width: NOTCH_W,
              height: NOTCH_H,
              backgroundImage: 'url(/art/ui.png)',
              backgroundPosition: index < filled ? 'var(--bar-fill)' : 'var(--bar-empty)',
              imageRendering: 'pixelated',
            }}
          />
        ))}
      </div>
    </div>
  );
}
