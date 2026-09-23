import type { VillagerDetail } from './types';

/** Stats shown as columns in the villager roster, in display order. */
export const ROSTER_STATS = [
  { key: 'hunger', label: 'Hunger', short: 'HUN' },
  { key: 'energy', label: 'Energy', short: 'NRG' },
  { key: 'social', label: 'Social', short: 'SOC' },
  { key: 'happiness', label: 'Happiness', short: 'HAP' },
] as const;

export type RosterStatKey = (typeof ROSTER_STATS)[number]['key'];
export type RosterSortKey = 'name' | RosterStatKey;
export type StatTone = 'critical' | 'low' | 'ok';

const CRITICAL_BELOW = 0.2;
const LOW_BELOW = 0.4;
const MAX_TAG_NAME = 14;

/** Severity bucket for a 0–1 need value, used to colour roster bars and flag villagers. */
export function statTone(value: number): StatTone {
  if (value < CRITICAL_BELOW) return 'critical';
  if (value < LOW_BELOW) return 'low';
  return 'ok';
}

/** The villager's most depleted need (happiness is derived, so it is excluded). */
export function lowestNeed(detail: VillagerDetail): { key: RosterStatKey; label: string; value: number } {
  let lowest: { key: RosterStatKey; label: string; value: number } | null = null;
  for (const stat of ROSTER_STATS) {
    if (stat.key === 'happiness') continue;
    const value = detail[stat.key];
    if (!lowest || value < lowest.value) lowest = { key: stat.key, label: stat.label, value };
  }
  return lowest!;
}

/**
 * Sort a roster copy. Names sort A→Z; stats sort neediest-first by default so the
 * villagers who need attention float to the top. Ties break on id for stability.
 */
export function sortRoster(
  roster: VillagerDetail[],
  key: RosterSortKey,
  descending = false,
): VillagerDetail[] {
  const direction = descending ? -1 : 1;
  return [...roster].sort((a, b) => {
    const primary = key === 'name' ? a.name.localeCompare(b.name) : a[key] - b[key];
    return primary !== 0 ? primary * direction : a.id - b.id;
  });
}

/**
 * Map villager id → name-tag label. Names can repeat (born villagers cycle a
 * fixed name list), so duplicated names get their id appended to stay unique.
 */
export function buildTagLabels(roster: VillagerDetail[]): Map<number, string> {
  const counts = new Map<string, number>();
  for (const detail of roster) counts.set(detail.name, (counts.get(detail.name) ?? 0) + 1);
  const labels = new Map<number, string>();
  for (const detail of roster) {
    const base =
      detail.name.length > MAX_TAG_NAME ? `${detail.name.slice(0, MAX_TAG_NAME - 1)}…` : detail.name;
    labels.set(detail.id, (counts.get(detail.name) ?? 0) > 1 ? `${base} #${detail.id}` : base);
  }
  return labels;
}

/** True when a snapshot contains a villager we have no tag label for (e.g. a birth). */
export function hasUnlabelledVillager(labels: ReadonlyMap<number, string>, ids: Iterable<number>): boolean {
  for (const id of ids) if (!labels.has(id)) return true;
  return false;
}
