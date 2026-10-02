import { useEffect, useRef } from 'react';
import { CHICKEN_DEMOLITION_WARNING } from './chickenDemolition';

export function ChickenDemolitionDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="chicken-demolition-title" aria-describedby="chicken-demolition-warning"
      onCancel={event => { event.preventDefault(); onCancel(); }}
      className="pixel-panel m-auto w-[min(24rem,90vw)] bg-[#1b3038] p-4 text-[#f7f4e9] backdrop:bg-black/60">
      <h2 id="chicken-demolition-title" className="text-lg">Remove chicken shelter?</h2>
      <p id="chicken-demolition-warning" className="my-3 text-sm leading-relaxed text-amber-100">{CHICKEN_DEMOLITION_WARNING}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus onClick={onCancel} className="pixel-btn pixel-focus px-3 py-2 text-sm">Keep flock</button>
        <button type="button" onClick={onConfirm} className="pixel-btn pixel-focus bg-red-950/60 px-3 py-2 text-sm text-red-100">Remove shelter and flock</button>
      </div>
    </dialog>
  );
}
