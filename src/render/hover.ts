import type { Catalog, TickSnapshot } from '../state/types';

const VILLAGER_STATE_LABELS = [
  'Idle',
  'Moving',
  'Working',
  'Eating',
  'Sleeping',
  'Socializing',
] as const;

export interface HoverTarget {
  kind: 'villager' | 'building' | 'crop';
  id: number;
  title: string;
  detail: string;
}

interface HoverTargetInput {
  snapshot: TickSnapshot;
  catalog: Catalog;
  worldX: number;
  worldY: number;
  tileSize: number;
  zoom: number;
}

function rotatedFootprint(footprint: [number, number], rotation: number): [number, number] {
  return rotation % 2 === 0 ? footprint : [footprint[1], footprint[0]];
}

/** Return the visually topmost inspectable entity under a world-space pointer. */
export function hoverTargetAt({
  snapshot,
  catalog,
  worldX,
  worldY,
  tileSize,
  zoom,
}: HoverTargetInput): HoverTarget | null {
  const hitRadius = Math.max(16, 22 / Math.max(zoom, 0.01));
  let closestVillager: { id: number; state: number | undefined; distance: number } | null = null;
  for (const villager of snapshot.villagers) {
    const distance = Math.hypot(villager.x - worldX, villager.y - worldY);
    if (distance <= hitRadius && (closestVillager == null || distance < closestVillager.distance)) {
      closestVillager = { id: villager.id, state: villager.state, distance };
    }
  }
  if (closestVillager) {
    return {
      kind: 'villager',
      id: closestVillager.id,
      title: `Villager #${closestVillager.id}`,
      detail: VILLAGER_STATE_LABELS[closestVillager.state ?? 0] ?? 'Unknown activity',
    };
  }

  const tileX = Math.floor(worldX / tileSize);
  const tileY = Math.floor(worldY / tileSize);
  const crop = snapshot.crops.find((entry) => entry.x === tileX && entry.y === tileY);
  if (crop) {
    const definition = catalog.crops[crop.kind];
    const stages = Math.max(1, definition?.stages ?? crop.stage + 1);
    return {
      kind: 'crop',
      id: crop.id,
      title: definition?.name ?? `Crop #${crop.id}`,
      detail: crop.stage >= stages - 1
        ? 'Ready to harvest'
        : `Growth stage ${crop.stage + 1} of ${stages}`,
    };
  }

  const building = snapshot.buildings.find((entry) => {
    const definition = catalog.buildings[entry.kind];
    if (!definition) return false;
    const [width, height] = rotatedFootprint(definition.footprint, entry.rot);
    return tileX >= entry.x
      && tileY >= entry.y
      && tileX < entry.x + width
      && tileY < entry.y + height;
  });
  if (building) {
    const definition = catalog.buildings[building.kind];
    return {
      kind: 'building',
      id: building.id,
      title: definition?.name ?? `Building #${building.id}`,
      detail: building.state === 2 ? 'Complete' : `Building · ${building.progress}%`,
    };
  }

  return null;
}
