import { seasonName } from './chronicle';
import type { SaveInfo } from './types';

export const MAX_SAVE_NAME_CHARS = 40;

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Mirrors `saves::validate_name` in src-tauri/src/saves.rs. */
export function validateSaveName(raw: string): NameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: 'save name cannot be empty' };
  if ([...name].length > MAX_SAVE_NAME_CHARS) {
    return { ok: false, error: `save name must be at most ${MAX_SAVE_NAME_CHARS} characters` };
  }
  if (/\p{Cc}/u.test(name)) return { ok: false, error: 'save name cannot contain control characters' };
  return { ok: true, name };
}

/** Newest first; ties broken by id (matches Rust `saves::list`). */
export function sortSaves(list: SaveInfo[]): SaveInfo[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function groupSaves(list: SaveInfo[]): { manual: SaveInfo[]; autosave: SaveInfo[] } {
  const sorted = sortSaves(list);
  return {
    manual: sorted.filter((save) => save.kind === 'manual'),
    autosave: sorted.filter((save) => save.kind === 'autosave'),
  };
}

export function formatGameDate(info: SaveInfo): string {
  if (info.year == null || info.season == null || info.day == null) return '—';
  return `Y${info.year} ${seasonName(info.season)} D${info.day}`;
}

export function formatSavedAt(savedAt: number, now: number): string {
  const elapsed = Math.max(0, now - savedAt);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The manual save that the dialog's primary SAVE overwrites. */
export type CurrentSave = { id: string; name: string } | null;

export type SaveEvent =
  | { type: 'saved' | 'loaded' | 'renamed'; info: SaveInfo }
  | { type: 'deleted'; id: string };

export function nextCurrentSave(current: CurrentSave, event: SaveEvent): CurrentSave {
  switch (event.type) {
    case 'saved':
    case 'loaded':
      return event.info.kind === 'manual' ? { id: event.info.id, name: event.info.name } : null;
    case 'renamed':
      return current?.id === event.info.id ? { id: current.id, name: event.info.name } : current;
    case 'deleted':
      return current?.id === event.id ? null : current;
  }
}

/** Speed to restore when the dialog closes; `null` means stay paused. */
export function resumeSpeedAfterDialog(speedOnOpen: number): number | null {
  return speedOnOpen > 0 ? speedOnOpen : null;
}
