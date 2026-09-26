import { describe, expect, it } from 'vitest';
import type { BuildingView, VillagerDetail, VillagerView } from '../state/types';
import {
  intentLabel,
  planIntentOverlay,
  PURPOSE_LABELS,
  STATE_MOVING,
  STATE_WORKING,
} from './intentOverlay';

function villager(partial: Partial<VillagerView> & Pick<VillagerView, 'id'>): VillagerView {
  return {
    x: 16,
    y: 16,
    ...partial,
  };
}

function detail(partial: Partial<VillagerDetail> & Pick<VillagerDetail, 'id'>): VillagerDetail {
  return {
    name: 'Ash',
    state: 0,
    stateLabel: 'Idle',
    hunger: 1,
    energy: 1,
    social: 1,
    thirst: 1,
    health: 1,
    happiness: 1,
    jobKind: null,
    jobSite: null,
    traits: [],
    tile: [0, 0],
    ...partial,
  };
}

function building(partial: Partial<BuildingView> & Pick<BuildingView, 'id'>): BuildingView {
  return {
    kind: 0,
    x: 4,
    y: 5,
    rot: 0,
    state: 2,
    progress: 100,
    ...partial,
  };
}

describe('intentLabel', () => {
  it('prefers activity labels over purpose bytes', () => {
    expect(
      intentLabel(villager({ id: 1, state: STATE_MOVING, purpose: 2, activity: 'visiting' })),
    ).toBe('Taking a stroll');
  });

  it('maps MovePurpose bytes like AgentState::label', () => {
    expect(intentLabel(villager({ id: 1, state: STATE_MOVING, purpose: 0 }))).toBe(PURPOSE_LABELS[0]);
    expect(intentLabel(villager({ id: 1, state: STATE_MOVING, purpose: 1 }))).toBe(PURPOSE_LABELS[1]);
    expect(intentLabel(villager({ id: 1, state: STATE_MOVING, purpose: 2 }))).toBe(PURPOSE_LABELS[2]);
    expect(intentLabel(villager({ id: 1, state: STATE_MOVING, purpose: 3 }))).toBe(PURPOSE_LABELS[3]);
  });
});

describe('planIntentOverlay', () => {
  it('returns null with no selection', () => {
    expect(
      planIntentOverlay({
        selectedId: null,
        villagers: [villager({ id: 1, state: STATE_MOVING, destination: [3, 4], purpose: 1 })],
        buildings: [],
        tileSize: 32,
      }),
    ).toBeNull();
  });

  it('plans a work walk with a dashed line', () => {
    const plan = planIntentOverlay({
      selectedId: 1,
      villagers: [
        villager({
          id: 1,
          x: 16,
          y: 16,
          state: STATE_MOVING,
          destination: [5, 2],
          purpose: 1,
        }),
      ],
      buildings: [],
      tileSize: 32,
    });
    expect(plan).toMatchObject({
      fromX: 16,
      fromY: 16,
      tileX: 5,
      tileY: 2,
      label: 'Going to work',
      showLine: true,
      footprintW: 1,
      footprintH: 1,
    });
  });

  it('plans a drink walk', () => {
    const plan = planIntentOverlay({
      selectedId: 2,
      villagers: [
        villager({ id: 2, x: 10, y: 10, state: STATE_MOVING, destination: [1, 7], purpose: 3 }),
      ],
      buildings: [],
      tileSize: 32,
    });
    expect(plan?.label).toBe('Fetching water');
    expect(plan?.showLine).toBe(true);
  });

  it('marks leisure destination while paused without a line', () => {
    const plan = planIntentOverlay({
      selectedId: 1,
      villagers: [
        villager({
          id: 1,
          x: 5 * 32 + 16,
          y: 3 * 32 + 16,
          state: 0,
          destination: [5, 3],
          activity: 'break',
        }),
      ],
      buildings: [],
      tileSize: 32,
    });
    expect(plan).toMatchObject({
      tileX: 5,
      tileY: 3,
      label: 'Taking a break',
      showLine: false,
    });
  });

  it('marks the job site while working', () => {
    const plan = planIntentOverlay({
      selectedId: 1,
      villagers: [villager({ id: 1, x: 100, y: 100, state: STATE_WORKING })],
      buildings: [building({ id: 9, kind: 0, x: 4, y: 5, rot: 0 })],
      footprints: [[3, 2]],
      detail: detail({ id: 1, state: STATE_WORKING, stateLabel: 'Working', jobKind: 'tend_crops', jobSite: 9 }),
      tileSize: 32,
    });
    expect(plan).toMatchObject({
      tileX: 4,
      tileY: 5,
      footprintW: 3,
      footprintH: 2,
      label: 'tend crops',
      showLine: false,
    });
  });

  it('returns null for idle villagers with no destination', () => {
    expect(
      planIntentOverlay({
        selectedId: 1,
        villagers: [villager({ id: 1, state: 0 })],
        buildings: [],
        detail: detail({ id: 1 }),
        tileSize: 32,
      }),
    ).toBeNull();
  });
});
