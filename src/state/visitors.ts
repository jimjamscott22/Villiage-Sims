import definitions from '../../src-tauri/data/visitors.json';
import type { VisitorKind } from './types';

export const VISITOR_DEFINITIONS = definitions;
export const FIRST_VISIT_TICKS = 1000;
export const VISIT_STAY_TICKS = 3000;
export const VISIT_GAP_TICKS = 6000;
const ORDER: VisitorKind[] = ['merchant', 'musician', 'grower'];
export interface Visits {
  active: { id: number; visitor: VisitorKind } | null;
  remainingTicks: number;
  nextId: number;
  nextIndex: number;
  growerSettled: boolean;
}
export interface VisitEvent {
  offset: number;
  id: number;
  visitor: VisitorKind;
  outcome: 'arrived' | 'expired';
}
export function initialVisits(): Visits {
  return { active: null, remainingTicks: FIRST_VISIT_TICKS, nextId: 1, nextIndex: 0, growerSettled: false };
}
export function finishVisit(state: Visits): void {
  state.active = null;
  state.remainingTicks = VISIT_GAP_TICKS;
}
export function advanceVisits(state: Visits, ticks: number): VisitEvent[] {
  const events: VisitEvent[] = [];
  let offset = 0;
  while (ticks >= state.remainingTicks) {
    ticks -= state.remainingTicks;
    offset += state.remainingTicks;
    if (state.active) {
      events.push({ offset, ...state.active, outcome: 'expired' });
      finishVisit(state);
    } else {
      if (state.growerSettled && state.nextIndex === 2) state.nextIndex = 0;
      state.active = { id: state.nextId++, visitor: ORDER[state.nextIndex] };
      state.nextIndex = (state.nextIndex + 1) % ORDER.length;
      state.remainingTicks = VISIT_STAY_TICKS;
      events.push({ offset, ...state.active, outcome: 'arrived' });
    }
  }
  state.remainingTicks -= ticks;
  return events;
}
export function validateVisits(state: Visits): void {
  if (!state || !Number.isSafeInteger(state.remainingTicks) || state.remainingTicks <= 0
    || state.remainingTicks > (state.active ? VISIT_STAY_TICKS : VISIT_GAP_TICKS)
    || !Number.isSafeInteger(state.nextId) || state.nextId < 1
    || !Number.isInteger(state.nextIndex) || state.nextIndex < 0 || state.nextIndex > 2
    || typeof state.growerSettled !== 'boolean'
    || (state.active !== null && (!state.active || !Number.isSafeInteger(state.active.id) || state.active.id < 1
      || state.active.id >= state.nextId || !ORDER.includes(state.active.visitor)
      || (state.growerSettled && state.active.visitor === 'grower')))) {
    throw new Error('save has invalid visitor state');
  }
}
