import { describe, expect, it } from 'vitest';
import { formatDivider, formatEntry, needsDivider, seasonName } from './chronicle';
import type { Catalog, ChronicleBody, ChronicleEntry } from './types';

const CATALOG = {
  buildings: [
    { id: 'farm', name: 'Farm Plot' },
    { id: 'mill', name: 'Mill' },
  ],
  crops: [],
} as unknown as Catalog;

const BIRTH: ChronicleBody = { kind: 'villagerBorn', id: 1, name: 'Anya' };

function entry(body: ChronicleBody, overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
  return { seq: 1, tick: 1, day: 1, season: 0, year: 1, focus: null, body, ...overrides };
}

describe('formatEntry', () => {
  it('formats a birth', () => {
    expect(formatEntry(entry({ kind: 'villagerBorn', id: 1, name: 'Anya' }), CATALOG))
      .toBe('Anya was born');
  });

  it('formats a death with its cause', () => {
    const e = entry({ kind: 'villagerDied', id: 2, name: 'Bram', cause: 'starvation' });
    expect(formatEntry(e, CATALOG)).toBe('Bram died of starvation');
  });

  it('resolves a building name through the catalog', () => {
    const e = entry({ kind: 'buildingComplete', id: 3, building: 'mill' });
    expect(formatEntry(e, CATALOG)).toBe('Mill completed');
  });

  it('falls back to the raw id when the catalog is absent', () => {
    const e = entry({ kind: 'buildingComplete', id: 3, building: 'mill' });
    expect(formatEntry(e, null)).toBe('mill completed');
  });

  it('formats an unlock', () => {
    expect(formatEntry(entry({ kind: 'buildingUnlocked', building: 'mill' }), CATALOG))
      .toBe('Mill unlocked');
  });

  it('singularises a one-crop harvest', () => {
    const e = entry({ kind: 'harvestReady', site: 4, building: 'farm', count: 1 });
    expect(formatEntry(e, CATALOG)).toBe('1 crop ready at Farm Plot');
  });

  it('pluralises a multi-crop harvest', () => {
    const e = entry({ kind: 'harvestReady', site: 4, building: 'farm', count: 3 });
    expect(formatEntry(e, CATALOG)).toBe('3 crops ready at Farm Plot');
  });

  it('omits the location for a bare crop', () => {
    const e = entry({ kind: 'harvestReady', site: 9, building: null, count: 2 });
    expect(formatEntry(e, CATALOG)).toBe('2 crops ready');
  });

  it('formats a season turn', () => {
    const e = entry({ kind: 'seasonTurned', season: 1, year: 2 });
    expect(formatEntry(e, CATALOG)).toBe('Summer of year 2 begins');
  });
});

describe('needsDivider', () => {
  const base = entry(BIRTH);

  it('is true for the first entry', () => {
    expect(needsDivider(null, base)).toBe(true);
  });

  it('is false within the same season and year', () => {
    expect(needsDivider(base, entry(BIRTH, { day: 4 }))).toBe(false);
  });

  it('is true across a season boundary', () => {
    expect(needsDivider(base, entry(BIRTH, { season: 1 }))).toBe(true);
  });

  it('is true across a year boundary', () => {
    expect(needsDivider(base, entry(BIRTH, { year: 2 }))).toBe(true);
  });
});

describe('seasonName and formatDivider', () => {
  it('names all four seasons', () => {
    expect([0, 1, 2, 3].map(seasonName)).toEqual(['Spring', 'Summer', 'Autumn', 'Winter']);
  });

  it('handles an out-of-range season', () => {
    expect(seasonName(9)).toBe('Unknown');
  });

  it('formats a divider', () => {
    const e = entry(BIRTH, { season: 2, year: 4 });
    expect(formatDivider(e)).toBe('Autumn · Year 4');
  });
});
