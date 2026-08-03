import { useEffect, useRef } from 'react';
import { formatDivider, formatEntry, needsDivider } from '../state/chronicle';
import type { Catalog, ChronicleEntry } from '../state/types';

interface ChronicleDrawerProps {
  entries: ChronicleEntry[];
  catalog: Catalog | null;
  collapsed: boolean;
  onToggle: () => void;
  onFocus: (tile: [number, number]) => void;
}

export function ChronicleDrawer({
  entries,
  catalog,
  collapsed,
  onToggle,
  onFocus,
}: ChronicleDrawerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottom = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || collapsed || !pinnedToBottom.current) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, collapsed]);

  const newest = entries[entries.length - 1] ?? null;

  return (
    <section
      className="shrink-0 border-t border-white/10 bg-[#121c18] text-xs text-white/80"
      data-testid="chronicle-drawer"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex h-7 w-full items-center gap-2 px-4 text-left hover:bg-white/5"
      >
        <span className="text-white/45">{collapsed ? '▸' : '▾'}</span>
        <span className="text-white/45">Chronicle</span>
        <span className="truncate text-white/80">
          {newest ? formatEntry(newest, catalog) : 'Nothing has happened yet.'}
        </span>
      </button>

      {!collapsed && (
        <div
          ref={scrollRef}
          onScroll={(event) => {
            const node = event.currentTarget;
            pinnedToBottom.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 24;
          }}
          className="max-h-48 overflow-y-auto border-t border-white/10 px-4 py-2"
        >
          {entries.length === 0 && <p className="text-white/45">Nothing has happened yet.</p>}
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry, index) => {
              const previous = index === 0 ? null : entries[index - 1];
              const text = formatEntry(entry, catalog);
              return (
                <li key={entry.seq}>
                  {needsDivider(previous, entry) && (
                    <div className="mt-2 border-b border-white/10 pb-1 text-[10px] uppercase tracking-wide text-white/35 first:mt-0">
                      {formatDivider(entry)}
                    </div>
                  )}
                  {entry.focus ? (
                    <button
                      type="button"
                      onClick={() => onFocus(entry.focus as [number, number])}
                      className="w-full rounded px-1 py-0.5 text-left hover:bg-white/10"
                    >
                      {text}
                    </button>
                  ) : (
                    <span className="block px-1 py-0.5 text-white/60">{text}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
