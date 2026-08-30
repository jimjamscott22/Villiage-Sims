import { useEffect } from 'react';
import type { ChronicleBody } from '../state/types';

export interface Toast {
  id: number;
  kind: ChronicleBody['kind'];
  message: string;
  tile: [number, number] | null;
}

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  onFocus: (tile: [number, number]) => void;
}

const KIND_STYLES: Record<ChronicleBody['kind'], string> = {
  villagerBorn: 'border-emerald-700/60 bg-emerald-950/90 text-emerald-100',
  villagerDied: 'border-rose-700/60 bg-rose-950/90 text-rose-100',
  buildingComplete: 'border-amber-700/60 bg-amber-950/90 text-amber-100',
  buildingUnlocked: 'border-sky-700/60 bg-sky-950/90 text-sky-100',
  harvestReady: 'border-lime-700/60 bg-lime-950/90 text-lime-100',
  seasonTurned: 'border-violet-700/60 bg-violet-950/90 text-violet-100',
};

export function ToastStack({ toasts, onDismiss, onFocus }: ToastStackProps) {
  return (
    <div className="pointer-events-none absolute left-3 top-14 z-20 flex max-w-xs flex-col gap-1.5">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onFocus={onFocus}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: number) => void;
  onFocus: (tile: [number, number]) => void;
}

function ToastItem({ toast, onDismiss, onFocus }: ToastItemProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const clickable = toast.tile != null;
  const style = KIND_STYLES[toast.kind] ?? 'border-white/20 bg-[#1a1510]/95 text-white/90';

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => {
        if (toast.tile) onFocus(toast.tile);
        onDismiss(toast.id);
      }}
      className={[
        'pointer-events-auto flex items-center gap-2 rounded border px-2.5 py-1.5 text-left text-xs shadow-lg backdrop-blur-sm transition-opacity',
        style,
        clickable ? 'cursor-pointer hover:opacity-90' : 'cursor-default',
      ].join(' ')}
    >
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide opacity-80">
        {toast.kind === 'villagerBorn' && 'Born'}
        {toast.kind === 'villagerDied' && 'Died'}
        {toast.kind === 'buildingComplete' && 'Built'}
      </span>
      <span className="leading-tight">{toast.message}</span>
    </button>
  );
}
