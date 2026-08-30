import { useEffect } from 'react';

export interface Floater {
  id: number;
  text: string;
  color: string;
}

interface FloatingTextProps {
  floaters: Floater[];
  onDismiss: (id: number) => void;
}

export function FloatingText({ floaters, onDismiss }: FloatingTextProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
      {floaters.map((floater) => (
        <FloaterItem key={floater.id} floater={floater} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface FloaterItemProps {
  floater: Floater;
  onDismiss: (id: number) => void;
}

function FloaterItem({ floater, onDismiss }: FloaterItemProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(floater.id), 1500);
    return () => window.clearTimeout(timer);
  }, [floater.id, onDismiss]);

  return (
    <div
      className="animate-float-up whitespace-nowrap text-sm font-bold drop-shadow-md"
      style={{ color: floater.color }}
    >
      {floater.text}
    </div>
  );
}
