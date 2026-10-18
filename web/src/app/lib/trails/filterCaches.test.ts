import { describe, expect, it } from 'vitest';

import { filterCandidates } from './filterCaches';
import { makeCache } from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './types';

const settings: TrailSettings = {
  ...DEFAULT_TRAIL_SETTINGS,
  cacheTypes: ['traditional', 'multi'],
};
const nothingFoundHere = new Set<string>();

function codesOf(caches: readonly { code: string }[]): string[] {
  return caches.map((cache) => cache.code);
}

describe('filterCandidates', () => {
  it('keeps a quick, available, unfound cache of an allowed type', () => {
    expect(
      codesOf(
        filterCandidates([makeCache({ code: 'GCOK' })], {
          settings,
          locallyFound: nothingFoundHere,
        }),
      ),
    ).toEqual(['GCOK']);
  });

  it.each([
    ['a type not chosen', { type: 'mystery' as const }],
    ['difficulty above the maximum', { difficulty: 2.5 }],
    ['terrain above the maximum', { terrain: 2.5 }],
    ['a disabled cache', { available: false }],
    ['an archived cache', { archived: true }],
    ['a cache the file marks found', { found: true }],
  ])('drops %s', (_, overrides) => {
    const caches = [
      makeCache({ code: 'GCKEEP' }),
      makeCache({ code: 'GCDROP', ...overrides }),
    ];
    expect(
      codesOf(
        filterCandidates(caches, { settings, locallyFound: nothingFoundHere }),
      ),
    ).toEqual(['GCKEEP']);
  });

  it('keeps difficulty and terrain exactly at the maximum and every chosen type', () => {
    const caches = [
      makeCache({ code: 'GCA', difficulty: 2, terrain: 1 }),
      makeCache({ code: 'GCB', difficulty: 1, terrain: 2 }),
      makeCache({ code: 'GCC', type: 'multi' }),
    ];
    expect(
      codesOf(
        filterCandidates(caches, { settings, locallyFound: nothingFoundHere }),
      ),
    ).toEqual(['GCA', 'GCB', 'GCC']);
  });

  it('drops caches marked found in the app', () => {
    const caches = [makeCache({ code: 'GCA' }), makeCache({ code: 'GCB' })];
    expect(
      codesOf(
        filterCandidates(caches, { settings, locallyFound: new Set(['GCA']) }),
      ),
    ).toEqual(['GCB']);
  });

  it('sorts by code so import order does not matter', () => {
    const caches = ['GCC', 'GCA', 'OC1', 'GCB', 'GC9'].map((code) =>
      makeCache({ code }),
    );
    expect(
      codesOf(
        filterCandidates(caches, { settings, locallyFound: nothingFoundHere }),
      ),
    ).toEqual(['GC9', 'GCA', 'GCB', 'GCC', 'OC1']);
  });

  it('keeps the given order between caches sharing a code', () => {
    const caches = [
      makeCache({ code: 'GCB', name: 'first' }),
      makeCache({ code: 'GCA' }),
      makeCache({ code: 'GCB', name: 'second' }),
    ];
    expect(
      filterCandidates(caches, {
        settings,
        locallyFound: nothingFoundHere,
      }).map((cache) => cache.name),
    ).toEqual(['Synthetic cache', 'first', 'second']);
  });

  it('returns nothing for nothing', () => {
    expect(
      filterCandidates([], { settings, locallyFound: nothingFoundHere }),
    ).toEqual([]);
  });
});
