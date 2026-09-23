import { describe, expect, it } from 'vitest';
import { generateDemoTerrain } from './demoTerrain';
import { DemoWorld } from './demoWorld';
import { buildTagLabels, hasUnlabelledVillager, lowestNeed, sortRoster, statTone } from './roster';
import type { VillagerDetail } from './types';

function detail(id: number, name: string, needs: Partial<VillagerDetail> = {}): VillagerDetail {
  return {
    id,
    name,
    state: 0,
    stateLabel: 'Idle',
    hunger: 1,
    energy: 1,
    social: 1,
    happiness: 1,
    jobKind: null,
    jobSite: null,
    traits: [],
    tile: [0, 0],
    ...needs,
  };
}

describe('roster helpers', () => {
  it('buckets need values into tones', () => {
    expect(statTone(0.1)).toBe('critical');
    expect(statTone(0.3)).toBe('low');
    expect(statTone(0.4)).toBe('ok');
  });

  it('finds the most depleted need, ignoring derived happiness', () => {
    const worst = lowestNeed(detail(1, 'Ada', { hunger: 0.5, energy: 0.2, social: 0.9, happiness: 0.05 }));
    expect(worst).toEqual({ key: 'energy', label: 'Energy', value: 0.2 });
  });

  it('sorts stats neediest-first and names alphabetically, without mutating input', () => {
    const roster = [
      detail(1, 'Cato', { hunger: 0.9 }),
      detail(2, 'Ada', { hunger: 0.1 }),
      detail(3, 'Bram', { hunger: 0.1 }),
    ];
    expect(sortRoster(roster, 'hunger').map((d) => d.id)).toEqual([2, 3, 1]);
    expect(sortRoster(roster, 'hunger', true).map((d) => d.id)).toEqual([1, 2, 3]);
    expect(sortRoster(roster, 'name').map((d) => d.name)).toEqual(['Ada', 'Bram', 'Cato']);
    expect(roster.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it('disambiguates duplicate names with the villager id', () => {
    const labels = buildTagLabels([detail(1, 'Ada'), detail(2, 'Bram'), detail(7, 'Ada')]);
    expect(labels.get(1)).toBe('Ada #1');
    expect(labels.get(2)).toBe('Bram');
    expect(labels.get(7)).toBe('Ada #7');
  });

  it('truncates very long names on tags', () => {
    const label = buildTagLabels([detail(1, 'Bartholomew Longbottom')]).get(1)!;
    expect(label.length).toBeLessThanOrEqual(14);
    expect(label.endsWith('…')).toBe(true);
  });

  it('detects villagers without a tag label', () => {
    const labels = new Map([[1, 'Ada']]);
    expect(hasUnlabelledVillager(labels, [1])).toBe(false);
    expect(hasUnlabelledVillager(labels, [1, 2])).toBe(true);
  });
});

describe('demo roster parity', () => {
  it('lists every villager by id with a tile', () => {
    const world = new DemoWorld(generateDemoTerrain());
    const roster = world.getVillagerRoster();
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.map((d) => d.id)).toEqual([...roster.map((d) => d.id)].sort((a, b) => a - b));
    for (const entry of roster) {
      expect(entry).toEqual(world.getVillagerDetail(entry.id));
      expect(entry.tile).toHaveLength(2);
    }
  });
});
