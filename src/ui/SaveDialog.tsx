import { useEffect, useRef, useState } from 'react';
import {
  formatGameDate,
  formatSavedAt,
  groupSaves,
  MAX_SAVE_NAME_CHARS,
  validateSaveName,
  type CurrentSave,
  type SaveEvent,
} from '../state/saves';
import { transport } from '../state/transport';
import type { SaveInfo } from '../state/types';
import { PixelText } from './PixelText';

interface SaveDialogProps {
  focus: 'save' | 'load';
  currentSave: CurrentSave;
  onSaveEvent: (event: SaveEvent) => void;
  onClose: () => void;
}

type Pending =
  | { action: 'overwrite' }
  | { action: 'load' | 'delete'; save: SaveInfo }
  | null;

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function SaveDialog({ focus, currentSave, onSaveEvent, onClose }: SaveDialogProps) {
  const [saves, setSaves] = useState<SaveInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const now = Date.now();

  const refresh = async () => {
    try {
      setSaves(await transport.listSaves());
    } catch (cause) {
      setSaves([]);
      setError(message(cause));
    }
  };

  useEffect(() => {
    void refresh();
    if (focus === 'save') nameRef.current?.focus();
    else dialogRef.current?.focus();
    // Mount-only: focus and first fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const saveAs = () =>
    run(async () => {
      const check = validateSaveName(draftName);
      if (!check.ok) throw new Error(check.error);
      onSaveEvent({ type: 'saved', info: await transport.saveGame(null, check.name) });
    });

  const overwriteCurrent = () =>
    run(async () => {
      if (!currentSave) return;
      onSaveEvent({ type: 'saved', info: await transport.saveGame(currentSave.id, currentSave.name) });
    });

  const load = (save: SaveInfo) =>
    run(async () => {
      await transport.loadGame(save.id);
      onSaveEvent({ type: 'loaded', info: save });
    });

  const remove = (save: SaveInfo) =>
    run(async () => {
      await transport.deleteSave(save.id);
      onSaveEvent({ type: 'deleted', id: save.id });
      await refresh();
    });

  const commitRename = () => {
    if (!renaming) return;
    const { id, draft } = renaming;
    void run(async () => {
      const check = validateSaveName(draft);
      if (!check.ok) throw new Error(check.error);
      onSaveEvent({ type: 'renamed', info: await transport.renameSave(id, check.name) });
      setRenaming(null);
      await refresh();
    });
  };

  // Listen on window, not the dialog element: after a row is deleted the focused
  // button disappears and focus falls back to <body>, outside the dialog.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (renaming) setRenaming(null);
      else if (pending) setPending(null);
      else if (!busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [renaming, pending, busy, onClose]);

  const groups = groupSaves(saves ?? []);

  const row = (save: SaveInfo) => {
    const confirming = pending && pending.action !== 'overwrite' && pending.save.id === save.id ? pending : null;
    const isRenaming = renaming?.id === save.id;
    return (
      <li key={save.id} className="border-b border-white/5 px-3 py-2" data-testid={`save-row-${save.id}`}>
        <div className="flex items-baseline gap-2">
          {isRenaming ? (
            <input
              autoFocus
              value={renaming.draft}
              maxLength={MAX_SAVE_NAME_CHARS * 2}
              onChange={(event) => setRenaming({ id: save.id, draft: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename();
              }}
              aria-label="New save name"
              className="pixel-focus min-w-0 flex-1 bg-black/40 px-1 text-white"
            />
          ) : (
            <span className={`min-w-0 flex-1 truncate ${currentSave?.id === save.id ? 'text-amber-200' : 'text-white'}`}>
              {save.name}
            </span>
          )}
          <span className="shrink-0 text-white/50">
            {formatGameDate(save)}
            {save.population != null && ` · pop ${save.population}`} · {formatSavedAt(save.savedAt, now)}
          </span>
        </div>
        <div className="mt-1 flex justify-end gap-1">
          {confirming ? (
            <>
              <span className="mr-auto text-amber-200">
                {confirming.action === 'load'
                  ? `Load "${save.name}"? Unsaved progress will be lost.`
                  : `Delete "${save.name}"?`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void (confirming.action === 'load' ? load(save) : remove(save))}
                className="pixel-btn pixel-focus px-2 py-0.5"
              >
                <PixelText text="YES" />
              </button>
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="NO" />
              </button>
            </>
          ) : isRenaming ? (
            <>
              <button type="button" disabled={busy} onClick={commitRename} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="OK" />
              </button>
              <button type="button" disabled={busy} onClick={() => setRenaming(null)} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="CANCEL" />
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => setPending({ action: 'load', save })} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="LOAD" />
              </button>
              {save.kind === 'manual' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRenaming({ id: save.id, draft: save.name })}
                  className="pixel-btn pixel-focus px-2 py-0.5"
                >
                  <PixelText text="RENAME" />
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => setPending({ action: 'delete', save })} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="DELETE" />
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        data-testid="save-dialog"
        className="pixel-panel flex max-h-[calc(100%-2rem)] w-[min(36rem,calc(100%-2rem))] flex-col text-xs text-white/80 outline-none"
      >
        <header className="flex shrink-0 items-center border-b border-white/10 px-3 py-2">
          <h2 id="save-dialog-title" className="text-[11px] text-white/60">
            <PixelText text="SAVES" />
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close saves"
            className="pixel-btn pixel-focus ml-auto px-1.5 py-0.5"
          >
            <PixelText text="X" />
          </button>
        </header>

        <div className="shrink-0 space-y-2 border-b border-white/10 px-3 py-2">
          <p>
            Current: <span className="text-white">{currentSave ? currentSave.name : 'Unsaved village'}</span>
          </p>
          {pending?.action === 'overwrite' && currentSave ? (
            <div className="flex items-center gap-1">
              <span className="mr-auto text-amber-200">Overwrite "{currentSave.name}"?</span>
              <button type="button" disabled={busy} onClick={() => void overwriteCurrent()} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="YES" />
              </button>
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="pixel-btn pixel-focus px-2 py-0.5">
                <PixelText text="NO" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="save-current"
                disabled={busy || !currentSave}
                onClick={() => setPending({ action: 'overwrite' })}
                className="pixel-btn pixel-focus px-2 py-1 disabled:opacity-40"
              >
                <PixelText text="SAVE" />
              </button>
              <span className="text-white/50">
                {currentSave ? `overwrites "${currentSave.name}"` : 'name a new save below'}
              </span>
            </div>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAs();
            }}
          >
            <label htmlFor="save-as-name" className="shrink-0">
              Save as new:
            </label>
            <input
              id="save-as-name"
              ref={nameRef}
              value={draftName}
              maxLength={MAX_SAVE_NAME_CHARS * 2}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Village name"
              data-testid="save-as-name"
              className="pixel-focus min-w-0 flex-1 bg-black/40 px-1 py-0.5 text-white"
            />
            <button type="submit" disabled={busy} data-testid="save-as" className="pixel-btn pixel-focus px-2 py-1 disabled:opacity-40">
              <PixelText text="SAVE AS" />
            </button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {saves == null ? (
            <p className="px-3 py-2 text-white/50">Loading…</p>
          ) : saves.length === 0 ? (
            <p className="px-3 py-2 text-white/50">No saves yet.</p>
          ) : (
            <>
              <h3 className="px-3 pt-2 text-[10px] text-white/50">MY SAVES</h3>
              <ul>{groups.manual.map(row)}</ul>
              {groups.autosave.length > 0 && (
                <>
                  <h3 className="px-3 pt-2 text-[10px] text-white/50">AUTOSAVES</h3>
                  <ul>{groups.autosave.map(row)}</ul>
                </>
              )}
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="shrink-0 border-t-2 border-red-500/50 bg-red-950/90 px-3 py-2 text-red-100">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
