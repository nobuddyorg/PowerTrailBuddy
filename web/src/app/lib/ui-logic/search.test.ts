import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { searchCaches } from './search';
import { makeCache } from './ui.test-support';

const CACHES = [
  makeCache({ code: 'GCSU12', name: 'Old Oak' }),
  makeCache({ code: 'GCSU1', name: 'Bench by the oak' }),
  makeCache({ code: 'GCSU2', name: 'Oakland Gate' }),
  makeCache({ code: 'GCSUX9', name: 'Cloak room' }),
  makeCache({ code: 'GCSU3', name: 'Mill pond' }),
];

const codes = (query: string, limit?: number) =>
  searchCaches(CACHES, { query, limit }).map((cache) => cache.code);

describe('searchCaches', () => {
  it('puts the exact code first, then codes starting with it', () => {
    expect(codes('gcsu1')).toEqual(['GCSU1', 'GCSU12']);
  });

  it('ranks a name word starting with the text above the text inside a word', () => {
    expect(codes('oak')).toEqual(['GCSU1', 'GCSU2', 'GCSU12', 'GCSUX9']);
  });

  it('ignores case and surrounding spaces', () => {
    expect(codes('  MILL ')).toEqual(['GCSU3']);
  });

  it('finds nothing for empty text or no match', () => {
    expect(codes('   ')).toEqual([]);
    expect(codes('zebra')).toEqual([]);
  });

  it('returns at most the limit, eight by default', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeCache({ code: `GCSUM${index}`, name: 'Same' }),
    );
    expect(searchCaches(many, { query: 'same' })).toHaveLength(8);
    expect(codes('oak', 2)).toEqual(['GCSU1', 'GCSU2']);
  });

  it('breaks a tie between equal names by code', () => {
    const twins = [
      makeCache({ code: 'GCSUB', name: 'Twin' }),
      makeCache({ code: 'GCSUA', name: 'Twin' }),
    ];
    expect(
      searchCaches(twins, { query: 'twin' }).map((cache) => cache.code),
    ).toEqual(['GCSUA', 'GCSUB']);
  });

  it('only ever returns caches whose code or name holds the text', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 4 }), (query) => {
        const normalized = query.trim().toLowerCase();
        for (const cache of searchCaches(CACHES, { query })) {
          const haystack = `${cache.code} ${cache.name}`.toLowerCase();
          expect(haystack).toContain(normalized);
        }
      }),
    );
  });
});
