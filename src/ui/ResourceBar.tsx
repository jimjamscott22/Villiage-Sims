import type { ResourceTotals } from '../state/types';

interface ResourceBarProps {
  resources: ResourceTotals | null;
}

const ENTRIES: Array<{ key: keyof ResourceTotals; label: string }> = [
  { key: 'wood', label: 'Wood' },
  { key: 'stone', label: 'Stone' },
  { key: 'grain', label: 'Grain' },
  { key: 'flour', label: 'Flour' },
  { key: 'food', label: 'Food' },
  { key: 'gold', label: 'Gold' },
];

export function ResourceBar({ resources }: ResourceBarProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-[#121c18] px-4 py-1.5 text-xs text-white/80"
      data-testid="resource-bar"
    >
      {ENTRIES.map(({ key, label }) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <span className="text-white/45">{label}</span>
          <span className="tabular-nums text-white/90">{resources?.[key] ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
