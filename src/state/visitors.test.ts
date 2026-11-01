import { describe, expect, it } from 'vitest';
import { advanceVisits, initialVisits, finishVisit, validateVisits } from './visitors';

describe('authored visitor schedule', () => {
  it('arrives at tick 1000, expires after 3000 ticks, and waits 6000 ticks', () => {
    const state = initialVisits();
    expect(advanceVisits(state, 999)).toEqual([]);
    expect(state.active).toBeNull();
    expect(advanceVisits(state, 1)).toEqual([{ offset: 1, id: 1, visitor: 'merchant', outcome: 'arrived' }]);
    expect(state.remainingTicks).toBe(3000);
    expect(advanceVisits(state, 2999)).toEqual([]);
    expect(advanceVisits(state, 1)[0].outcome).toBe('expired');
    expect(advanceVisits(state, 5999)).toEqual([]);
    expect(advanceVisits(state, 1)[0].visitor).toBe('musician');
  });
  it('rotates after decisions, skips the settled grower, and matches chunked advancement', () => {
    const state = initialVisits();
    advanceVisits(state, 1000);
    finishVisit(state);
    advanceVisits(state, 6000);
    finishVisit(state);
    advanceVisits(state, 6000);
    expect(state.active?.visitor).toBe('grower');
    state.growerSettled = true;
    finishVisit(state);
    advanceVisits(state, 6000);
    expect(state.active?.visitor).toBe('merchant');
    finishVisit(state);
    advanceVisits(state, 6000);
    finishVisit(state);
    advanceVisits(state, 6000);
    expect(state.active?.visitor).toBe('merchant');
    const a = initialVisits(); const b = initialVisits();
    advanceVisits(a, 24000);
    for (let i = 0; i < 24; i++) advanceVisits(b, 1000);
    expect(a).toEqual(b);
  });
  it('rejects invalid persisted timers, identity and settled grower', () => {
    const state = initialVisits();
    expect(() => validateVisits(state)).not.toThrow();
    for (const remainingTicks of [0, -1, NaN, 1.5, 6001]) {
      expect(() => validateVisits({ ...state, remainingTicks })).toThrow('visitor');
    }
    expect(() => validateVisits({ ...state, nextId: 0 })).toThrow('visitor');
    advanceVisits(state, 1000);
    expect(() => validateVisits({ ...state, active: { id: 0, visitor: 'merchant' } })).toThrow('visitor');
    expect(() => validateVisits({ ...state, growerSettled: true, active: { id: 1, visitor: 'grower' } })).toThrow('visitor');
  });
});
