import { useState } from 'react';
import type { Catalog, ObjectiveDef } from '../state/types';
import { PixelText } from './PixelText';

interface ObjectivesPanelProps {
  catalog: Catalog | null;
  completed: string[];
}

function conditionText(def: ObjectiveDef): string {
  const c = def.condition;
  if ('buildingCount' in c) {
    return `Build ${c.buildingCount.count} ${c.buildingCount.id}`;
  }
  if ('population' in c) {
    return `Reach ${c.population.count} villagers`;
  }
  if ('resource' in c) {
    return `Stockpile ${c.resource.count} ${c.resource.id}`;
  }
  if ('buildingUnlocked' in c) {
    return `Unlock ${c.buildingUnlocked.id}`;
  }
  return '';
}

export function ObjectivesPanel({ catalog, completed }: ObjectivesPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const completedSet = new Set(completed);
  const objectives = catalog?.objectives ?? [];
  const active = objectives.filter((obj) => !completedSet.has(obj.id));
  const done = objectives.filter((obj) => completedSet.has(obj.id));

  return (
    <section className="pixel-panel shrink-0 text-xs text-white/80">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="pixel-focus flex h-8 w-full items-center gap-2 px-4 text-left hover:bg-white/5"
      >
        <span className="text-white/45">{collapsed ? '▸' : '▾'}</span>
        <span className="text-white/45">
          <PixelText text="OBJECTIVES" />
        </span>
        <span className="ml-auto text-white/55">
          {completed.length}/{objectives.length}
        </span>
      </button>

      {!collapsed && (
        <div className="max-h-48 overflow-y-auto border-t border-white/10 px-4 py-2">
          {objectives.length === 0 && (
            <p className="text-white/45">No objectives available.</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {active.map((obj) => (
              <li key={obj.id} className="flex flex-col gap-0.5">
                <div className="font-medium text-white/90">{obj.title}</div>
                <div className="text-[11px] text-white/55">{obj.description}</div>
                <div className="text-[10px] text-amber-300/70">{conditionText(obj)}</div>
              </li>
            ))}
            {done.length > 0 && (
              <li className="mt-1 border-t border-white/10 pt-1 text-[10px] text-white/40">
                Completed: {done.map((obj) => obj.title).join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
