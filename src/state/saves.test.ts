import { describe, expect, it } from 'vitest';
import {
  formatGameDate,
  formatSavedAt,
  groupSaves,
  nextCurrentSave,
  resumeSpeedAfterDialog,
  sortSaves,
  validateSaveName,
} from './saves';
import type { SaveInfo } from './types';

function info(overrides: Partial<SaveInfo> = {}): SaveInfo {
  return {
    id: 's-1',
    name: 'Riverbend',
    kind: 'manual',
    savedAt: 1_000,
    year: 2,
    season: 1,
    day: 4,
    population: 14,
    ...overrides,
  };
}

describe('validateSaveName', () => {
  it('trims and accepts normal names', () => {
    expect(validateSaveName('  Riverbend ')).toEqual({ ok: true, name: 'Riverbend' });
  });
  it('rejects empty, too long, and control characters with the Rust messages', () => {
    expect(validateSaveName('   ')).toEqual({ ok: false, error: 'save name cannot be empty' });
    expect(validateSaveName('a'.repeat(41))).toEqual({
      ok: false,
      error: 'save name must be at most 40 characters',
    });
    expect(validateSaveName('bad\u0007name')).toEqual({
      ok: false,
      error: 'save name cannot contain control characters',
    });
  });
  it('counts characters, not UTF-16 units', () => {
    expect(validateSaveName('🌾'.repeat(40)).ok).toBe(true);
  });
});

describe('sortSaves / groupSaves', () => {
  it('orders newest first, ties by id, and splits by kind', () => {
    const list = [
      info({ id: 's-1', savedAt: 1 }),
      info({ id: 'autosave-2', kind: 'autosave', savedAt: 3 }),
      info({ id: 's-3', savedAt: 3 }),
    ];
    expect(sortSaves(list).map((s) => s.id)).toEqual(['autosave-2', 's-3', 's-1']);
    const groups = groupSaves(list);
    expect(groups.manual.map((s) => s.id)).toEqual(['s-3', 's-1']);
    expect(groups.autosave.map((s) => s.id)).toEqual(['autosave-2']);
  });
});

describe('formatting', () => {
  it('formats the in-game date or a dash when unknown', () => {
    expect(formatGameDate(info())).toBe('Y2 Summer D4');
    expect(formatGameDate(info({ year: null, season: null, day: null }))).toBe('—');
  });
  it('formats relative wall-clock time', () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0);
    expect(formatSavedAt(now - 10_000, now)).toBe('just now');
    expect(formatSavedAt(now - 2 * 60_000, now)).toBe('2m ago');
    expect(formatSavedAt(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatSavedAt(Date.UTC(2026, 8, 28, 12), now)).toBe('Sep 28');
  });
});

describe('nextCurrentSave', () => {
  const current = { id: 's-1', name: 'Riverbend' };
  it('tracks manual saves and loads', () => {
    expect(nextCurrentSave(null, { type: 'saved', info: info({ id: 's-2', name: 'New' }) })).toEqual({
      id: 's-2',
      name: 'New',
    });
    expect(nextCurrentSave(null, { type: 'loaded', info: info() })).toEqual(current);
  });
  it('clears on loading an autosave', () => {
    expect(
      nextCurrentSave(current, { type: 'loaded', info: info({ id: 'autosave-1', kind: 'autosave' }) }),
    ).toBeNull();
  });
  it('follows renames and deletes of the current save only', () => {
    expect(nextCurrentSave(current, { type: 'renamed', info: info({ name: 'Renamed' }) })).toEqual({
      id: 's-1',
      name: 'Renamed',
    });
    expect(nextCurrentSave(current, { type: 'renamed', info: info({ id: 's-9' }) })).toBe(current);
    expect(nextCurrentSave(current, { type: 'deleted', id: 's-1' })).toBeNull();
    expect(nextCurrentSave(current, { type: 'deleted', id: 's-9' })).toBe(current);
  });
});

describe('resumeSpeedAfterDialog', () => {
  it('restores a running speed and leaves a paused game paused', () => {
    expect(resumeSpeedAfterDialog(2)).toBe(2);
    expect(resumeSpeedAfterDialog(0)).toBeNull();
  });
});
