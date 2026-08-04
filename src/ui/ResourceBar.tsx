import type { ResourceTotals } from '../state/types';
import { PixelText } from './PixelText';
import { uiIconStyle } from './pixelUi';

interface ResourceBarProps {
  resources: ResourceTotals | null;
  population?: number;
  housingCapacity?: number;
}

const ENTRIES: Array<{ key: keyof ResourceTotals; label: string; icon: string }> = [
  { key: 'wood', label: 'Wood', icon: 'ui.icon.wood' },
  { key: 'stone', label: 'Stone', icon: 'ui.icon.stone' },
  { key: 'grain', label: 'Grain', icon: 'ui.icon.grain' },
  { key: 'flour', label: 'Flour', icon: 'ui.icon.flour' },
  { key: 'food', label: 'Food', icon: 'ui.icon.food' },
  { key: 'gold', label: 'Gold', icon: 'ui.icon.gold' },
];

export function ResourceBar({ resources, population, housingCapacity }: ResourceBarProps) {
  return (
    <div
      className="pixel-panel flex shrink-0 items-center gap-4 px-4 py-2 text-xs text-white/80"
      data-testid="resource-bar"
    >
      {population != null && housingCapacity != null && (
        <div className="flex items-center gap-2 border-r border-white/10 pr-3">
          <span className="text-white/45 text-[11px]">Pop</span>
          <PixelText text={`${population}/${housingCapacity}`} />
        </div>
      )}
      {ENTRIES.map(({ key, label, icon }) => (
        <div key={key} className="flex items-center gap-1.5" title={label}>
          <span className="pixel-icon" style={uiIconStyle(icon)} />
          <PixelText text={resources?.[key] != null ? String(resources[key]) : '-'} />
        </div>
      ))}
    </div>
  );
}
