import { useRef, useState } from 'react';
import type { VisitDecision, VisitorView } from '../state/types';
import { PixelText } from './PixelText';

interface VisitorPanelProps {
  visitor: VisitorView;
  onRespond: (decision: VisitDecision) => Promise<void>;
  disabled?: boolean;
}

export function VisitorPanel({ visitor, onRespond, disabled = false }: VisitorPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const hours = Math.floor(visitor.remainingMinutes / 60);
  const minutes = visitor.remainingMinutes % 60;
  const remaining = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  const cost = Object.entries(visitor.cost).map(([resource, amount]) => `${amount} ${resource}`).join(', ') || 'No resource cost';

  const respond = async (decision: VisitDecision) => {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await onRespond(decision);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-label="Visitor offer" className="pixel-panel shrink-0 px-3 py-2 text-sm" data-testid="visitor-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="font-bold text-amber-200">{visitor.name} · {visitor.title}</h2>
        <span className="text-amber-100/80">Leaves in {remaining} of game time</span>
      </div>
      <p className="my-1 text-[#e2ddcd]">{visitor.introduction}</p>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <p><span className="text-amber-200">Give:</span> {cost}</p>
          <p><span className="text-emerald-200">Receive:</span> {visitor.reward}</p>
          {visitor.unavailableReason && <p id="visitor-unavailable" className="mt-1 text-amber-200">{visitor.unavailableReason}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="pixel-btn pixel-focus px-3 py-1 disabled:opacity-50"
            aria-describedby={visitor.unavailableReason ? 'visitor-unavailable' : undefined}
            disabled={disabled || busy || !visitor.canAccept} onClick={() => { void respond('accept'); }}>
            <PixelText text={busy ? 'WAIT...' : 'ACCEPT'} />
          </button>
          <button type="button" className="pixel-btn pixel-focus px-3 py-1 disabled:opacity-50"
            disabled={disabled || busy} onClick={() => { void respond('decline'); }}>
            <PixelText text="DECLINE" />
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-rose-200">{error}</p>}
    </section>
  );
}
