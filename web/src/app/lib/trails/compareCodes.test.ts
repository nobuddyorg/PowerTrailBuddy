import { describe, expect, it } from 'vitest';

import { compareCodes } from './compareCodes';

describe('compareCodes', () => {
  it('orders codes character by character, digits before letters', () => {
    expect(
      ['OC1', 'GCZ', 'GC9', 'GC10', 'GCA', 'GC1'].sort(compareCodes),
    ).toEqual(['GC1', 'GC10', 'GC9', 'GCA', 'GCZ', 'OC1']);
  });

  it('answers -1, 1 or 0', () => {
    expect(compareCodes('GCA', 'GCB')).toBe(-1);
    expect(compareCodes('GCB', 'GCA')).toBe(1);
    expect(compareCodes('GC1ABC', 'GC1ABC')).toBe(0);
  });

  it('puts a code before a longer one it starts, and a trail id before the next size', () => {
    expect(compareCodes('GCA', 'GCAB')).toBe(-1);
    expect(compareCodes('GCA-3', 'GCA1-10')).toBe(-1);
  });
});
