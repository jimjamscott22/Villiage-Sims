import { Fragment, useEffect, useRef } from 'react';
import { CHRONICLE_EMPTY_MESSAGE, formatDivider, formatEntry, needsDivider } from '../state/chronicle';
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
      className="pixel-panel shrink-0 text-xs text-white/80"
      data-testid="chronicle-drawer"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="pixel-focus flex h-8 w-full items-center gap-2 px-4 text-left hover:bg-white/5"
      >
        <span className="text-white/45">{collapsed ? '▸' : '▾'}</span>
        <span className="text-white/45">Chronicle</span>
        <span className="truncate text-white/80">
          {newest ? formatEntry(newest, catalog) : CHRONICLE_EMPTY_MESSAGE}
        </span>
      </button>

      {entries.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-1.5">
          {entries.slice(-5).map((entry) => {
            const text = formatEntry(entry, catalog);
            return (
              <button
                key={entry.seq}
                type="button"
                disabled={entry.focus == null}
                onClick={() => entry.focus && onFocus(entry.focus as [number, number])}
                title={text}
                className={[
                  'pixel-focus shrink-0 truncate rounded px-1.5 py-0.5 text-[10px]',
                  entry.focus ? 'hover:bg-white/10' : 'cursor-default opacity-50',
                ].join(' ')}
              >
                {text.length > 24 ? `${text.slice(0, 24)}…` : text}
              </button>
            );
          })}
        </div>
      )}

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
          {entries.length === 0 && <p className="text-white/45">{CHRONICLE_EMPTY_MESSAGE}</p>}
          <ul className="flex flex-col gap-0.5">
            {entries.map((entry, index) => {
              const previous = index === 0 ? null : entries[index - 1];
              const text = formatEntry(entry, catalog);
              return (
                <Fragment key={entry.seq}>
                  {needsDivider(previous, entry) && (
                    // A sibling <li> (not nested inside the entry's <li>) so `first:mt-0`
                    // targets whichever element is actually first in the <ul> — nesting it
                    // meant the divider was always its <li>'s first child and the spacing
                    // never applied.
                    <li
                      aria-hidden
                      className="mt-2 border-b border-white/10 pb-1 text-[10px] uppercase tracking-wide text-white/35 first:mt-0"
                    >
                      {formatDivider(entry)}
                    </li>
                  )}
                  <li>
                    {entry.focus ? (
                      <button
                        type="button"
                        onClick={() => onFocus(entry.focus as [number, number])}
                        className="pixel-focus w-full rounded px-1 py-0.5 text-left hover:bg-white/10"
                      >
                        {text}
                      </button>
                    ) : (
                      <span className="block px-1 py-0.5 text-white/60">{text}</span>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
