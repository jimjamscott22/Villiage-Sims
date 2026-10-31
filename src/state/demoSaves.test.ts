import { describe, expect, it } from 'vitest';
import { DemoSaveStore } from './demoSaves';

const summary = { year: 1, season: 2, day: 3, population: 6 };

function store() {
  let now = 1_000;
  return new DemoSaveStore(() => (now += 1_000));
}

describe('DemoSaveStore', () => {
  it('creates, lists newest first, and reads back state', () => {
    const saves = store();
    const a = saves.save(null, ' First ', 'state-a', summary);
    const b = saves.save(null, 'Second', 'state-b', summary);
    expect(a).toMatchObject({ name: 'First', kind: 'manual', year: 1, season: 2, day: 3, population: 6 });
    expect(a.id).not.toBe(b.id);
    expect(saves.list().map((s) => s.name)).toEqual(['Second', 'First']);
    expect(saves.read(a.id)).toBe('state-a');
  });

  it('overwrites an existing manual save in place', () => {
    const saves = store();
    const a = saves.save(null, 'First', 'old', summary);
    const again = saves.save(a.id, 'First v2', 'new', { ...summary, day: 9 });
    expect(again.id).toBe(a.id);
    expect(again.day).toBe(9);
    expect(saves.read(a.id)).toBe('new');
    expect(saves.list()).toHaveLength(1);
    expect(() => saves.save('s-404', 'x', 's', summary)).toThrow('save not found');
  });

  it('keeps autosaves separate and protects them from overwrite/rename', () => {
    const saves = store();
    saves.writeAutosave(2, 'auto', summary);
    const [auto] = saves.list();
    expect(auto).toMatchObject({ id: 'autosave-2', name: 'Autosave 2', kind: 'autosave' });
    expect(() => saves.save('autosave-2', 'x', 's', summary)).toThrow('autosaves cannot be overwritten');
    expect(() => saves.rename('autosave-2', 'x')).toThrow('autosaves cannot be renamed');
    saves.delete('autosave-2');
    expect(saves.list()).toEqual([]);
  });

  it('renames, deletes, and validates names', () => {
    const saves = store();
    const a = saves.save(null, 'First', 's', summary);
    expect(saves.rename(a.id, ' Renamed ').name).toBe('Renamed');
    expect(() => saves.rename(a.id, '  ')).toThrow('save name cannot be empty');
    expect(() => saves.save(null, 'a'.repeat(41), 's', summary)).toThrow(
      'save name must be at most 40 characters',
    );
    saves.delete(a.id);
    expect(() => saves.read(a.id)).toThrow('save not found');
    expect(() => saves.delete(a.id)).toThrow('save not found');
  });
});
