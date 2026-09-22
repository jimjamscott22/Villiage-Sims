import { describe, expect, it } from 'vitest';
import { nextSelection } from './BuildMenu';

describe('nextSelection', () => {
  it('selects a new id when none is selected', () => {
    expect(nextSelection(null, 'farm')).toBe('farm');
  });

  it('switches selection when clicking a different id', () => {
    expect(nextSelection('hut', 'farm')).toBe('farm');
  });

  it('clears selection when clicking the active id', () => {
    expect(nextSelection('farm', 'farm')).toBeNull();
  });
});
