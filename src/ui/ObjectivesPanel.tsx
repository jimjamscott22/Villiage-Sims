import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const completedSet = new Set(completed);
  const objectives = catalog?.objectives ?? [];
  const active = objectives.filter((obj) => !completedSet.has(obj.id));
  const done = objectives.filter((obj) => completedSet.has(obj.id));
  const current = active[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid="objectives-menu"
        onClick={() => setOpen((value) => !value)}
        title={current?.title ?? 'Objectives'}
        className="pixel-btn pixel-focus flex items-center gap-2 px-2 py-1"
      >
        <PixelText text="OBJECTIVES" />
        <span className="text-[11px] text-[#f7f4e9]">
          {completed.length}/{objectives.length}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Objectives"
          className="pixel-panel absolute right-0 top-full z-30 mt-1 w-72 p-3 text-xs"
        >
          {objectives.length === 0 && (
            <p className="text-[#d4cfc0]">No objectives available.</p>
          )}
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {active.map((obj) => (
              <li key={obj.id} className="flex flex-col gap-0.5">
                <div className="font-medium text-[#f7f4e9]">{obj.title}</div>
                <div className="text-[11px] leading-snug text-[#d4cfc0]">{obj.description}</div>
                <div className="text-[10px] text-amber-200">{conditionText(obj)}</div>
              </li>
            ))}
            {done.length > 0 && (
              <li className="mt-1 border-t border-white/10 pt-2 text-[10px] text-[#c5c0a8]">
                Completed: {done.map((obj) => obj.title).join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
