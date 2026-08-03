import type { Catalog, ChronicleEntry } from './types';

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const CHRONICLE_EMPTY_MESSAGE = 'Nothing has happened yet.';

export function seasonName(season: number): string {
  return SEASONS[season] ?? 'Unknown';
}

function buildingName(building: string | null | undefined, catalog: Catalog | null): string | null {
  if (!building) return null;
  return catalog?.buildings.find((b) => b.id === building)?.name ?? building;
}

export function formatEntry(entry: ChronicleEntry, catalog: Catalog | null): string {
  const body = entry.body;
  switch (body.kind) {
    case 'villagerBorn':
      return `${body.name} was born`;
    case 'villagerDied':
      return `${body.name} died of ${body.cause}`;
    case 'buildingComplete':
      return `${buildingName(body.building, catalog) ?? 'A building'} completed`;
    case 'buildingUnlocked':
      return `${buildingName(body.building, catalog) ?? 'A building'} unlocked`;
    case 'harvestReady': {
      const noun = body.count === 1 ? 'crop' : 'crops';
      const site = buildingName(body.building, catalog);
      const where = site ? ` at ${site}` : '';
      return `${body.count} ${noun} ready${where}`;
    }
    case 'seasonTurned':
      return `${seasonName(body.season)} of year ${body.year} begins`;
    default: {
      // Exhaustiveness guard: if Rust adds a chronicle body variant the TS
      // union doesn't know about yet, this becomes a compile error instead of
      // formatEntry silently returning undefined (and rendering blank).
      const _exhaustive: never = body;
      return `Unknown event (${(_exhaustive as { kind: string }).kind})`;
    }
  }
}

export function needsDivider(prev: ChronicleEntry | null, entry: ChronicleEntry): boolean {
  if (prev === null) return true;
  return prev.season !== entry.season || prev.year !== entry.year;
}

export function formatDivider(entry: ChronicleEntry): string {
  return `${seasonName(entry.season)} · Year ${entry.year}`;
}
