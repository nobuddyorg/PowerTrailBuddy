import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { syntheticCache } from './gpx.test-support';
import { mergeCaches, type IncomingCaches } from './mergeCaches';
import type { Geocache } from './types';

const QUERIES = ['26071826', '26071827', '26071828'];

function from(index: number, ...sources: string[]): Geocache {
  return syntheticCache(index, { sources });
}

/** An import of `caches` that read the queries their sources name. */
function importOf(...caches: Geocache[]): IncomingCaches {
  return {
    caches,
    sources: [...new Set(caches.flatMap((cache) => cache.sources))].sort(),
  };
}

function codes(caches: readonly Geocache[]): string[] {
  return caches.map((cache) => cache.code);
}

const first = from(1, 'a');
const second = from(2, 'a');
const third = from(3, 'b');

describe('mergeCaches: a union by code', () => {
  it('keeps existing caches first, then appends new ones', () => {
    expect(mergeCaches([first, second], importOf(third))).toEqual({
      caches: [first, second, third],
      removedCount: 0,
    });
  });

  it('replaces an existing cache with the incoming one of the same code, in place', () => {
    const disabled = { ...first, available: false };
    expect(mergeCaches([first, second], importOf(disabled, second))).toEqual({
      caches: [disabled, second],
      removedCount: 0,
    });
  });

  it('keeps the last of several incoming caches with one code', () => {
    const archived = { ...second, archived: true };
    expect(mergeCaches([], importOf(second, archived)).caches).toEqual([
      archived,
    ]);
  });

  it('returns an empty list for two empty lists', () => {
    expect(mergeCaches([], { caches: [], sources: [] })).toEqual({
      caches: [],
      removedCount: 0,
    });
  });

  it('does not change its inputs', () => {
    const existing = [first, second];
    const incoming = importOf({ ...first, found: true });
    mergeCaches(existing, incoming);
    expect([existing, incoming]).toEqual([
      [first, second],
      importOf({ ...first, found: true }),
    ]);
  });
});

describe('mergeCaches: a query imported again', () => {
  it('drops the caches it no longer lists', () => {
    const merged = mergeCaches([first, second, third], importOf(second));

    expect(merged.caches).toEqual([second, third]);
    expect(merged.removedCount).toBe(1);
  });

  it('drops every cache of a query that now lists none', () => {
    const merged = mergeCaches([first, second, third], {
      caches: [],
      sources: ['a'],
    });

    expect(merged.caches).toEqual([third]);
    expect(merged.removedCount).toBe(2);
  });

  it('leaves the caches of other queries alone', () => {
    const merged = mergeCaches([first, third], importOf(first));

    expect(merged.caches).toEqual([first, third]);
  });

  it('keeps a cache another query still lists, without the query that dropped it', () => {
    const shared = from(4, 'a', 'b');

    const merged = mergeCaches([shared, first], importOf(first));

    expect(merged.caches).toEqual([from(4, 'b'), first]);
    expect(merged.removedCount).toBe(0);
  });

  it('records every query that lists a cache, sorted', () => {
    const merged = mergeCaches([from(4, 'b')], importOf(from(4, 'a')));

    expect(merged.caches).toEqual([from(4, 'a', 'b')]);
  });

  it('moves a cache from one query to another', () => {
    const merged = mergeCaches(
      [from(4, 'a'), from(5, 'a')],
      importOf(from(5, 'a'), from(4, 'b')),
    );

    expect(merged.caches).toEqual([from(4, 'b'), from(5, 'a')]);
  });

  it('keeps a cache stored before sources were kept, whatever is imported', () => {
    const unknown = from(4);

    const merged = mergeCaches([unknown, first], importOf(second));

    expect(merged.caches).toEqual([unknown, second]);
    expect(merged.removedCount).toBe(1);
  });

  it('gives a cache stored before sources were kept the query that lists it again', () => {
    expect(mergeCaches([from(4)], importOf(from(4, 'a'))).caches).toEqual([
      from(4, 'a'),
    ]);
  });
});

// As stored: each code once.
const cachesArbitrary = fc
  .uniqueArray(
    fc.record({
      index: fc.nat({ max: 12 }),
      found: fc.boolean(),
      sources: fc.subarray(QUERIES),
    }),
    { maxLength: 13, selector: (spec) => spec.index },
  )
  .map((specs) =>
    specs.map(({ index, found, sources }) =>
      syntheticCache(index, { found, sources }),
    ),
  );

// As importFiles builds it: each cache once, with sources from the queries it read.
const importArbitrary: fc.Arbitrary<IncomingCaches> = fc
  .record({
    sources: fc.subarray(QUERIES, { minLength: 1 }),
    picks: fc.array(
      fc.record({ index: fc.nat({ max: 12 }), found: fc.boolean() }),
      { maxLength: 15 },
    ),
    choice: fc.array(fc.nat(), { minLength: 15, maxLength: 15 }),
  })
  .map(({ sources, picks, choice }) => {
    const byCode = new Map<string, Geocache>();
    picks.forEach(({ index, found }, position) => {
      const source = sources[choice[position] % sources.length];
      byCode.set(
        syntheticCache(index).code,
        syntheticCache(index, { found, sources: [source] }),
      );
    });
    return { caches: [...byCode.values()], sources };
  });

describe('mergeCaches: properties', () => {
  it('is idempotent: merging the same import again changes nothing', () => {
    fc.assert(
      fc.property(cachesArbitrary, importArbitrary, (existing, incoming) => {
        const once = mergeCaches(existing, incoming).caches;
        expect(mergeCaches(once, incoming)).toEqual({
          caches: once,
          removedCount: 0,
        });
      }),
    );
  });

  it('holds each code once, every incoming cache as given, and exactly the existing ones an unreplaced query or no query has', () => {
    fc.assert(
      fc.property(cachesArbitrary, importArbitrary, (existing, incoming) => {
        const merged = mergeCaches(existing, incoming);
        const byCode = new Map(
          merged.caches.map((cache) => [cache.code, cache]),
        );
        expect(byCode.size).toBe(merged.caches.length);
        for (const cache of incoming.caches) {
          const stored = byCode.get(cache.code)!;
          expect({ ...stored, sources: cache.sources }).toEqual(cache);
          expect(stored.sources).toEqual(expect.arrayContaining(cache.sources));
        }
        const incomingCodes = new Set(codes(incoming.caches));
        const kept = new Map(
          existing
            .filter(
              (cache) =>
                cache.sources.length === 0 ||
                cache.sources.some(
                  (source) => !incoming.sources.includes(source),
                ),
            )
            .map((cache) => [cache.code, cache]),
        );
        const expected = new Set([...incomingCodes, ...kept.keys()]);
        expect(new Set(byCode.keys())).toEqual(expected);
        const existingCodes = new Set(codes(existing));
        expect(merged.removedCount).toBe(
          [...existingCodes].filter((code) => !expected.has(code)).length,
        );
      }),
    );
  });

  it('never drops a cache that the import lists or that has no source', () => {
    fc.assert(
      fc.property(cachesArbitrary, importArbitrary, (existing, incoming) => {
        const merged = new Set(codes(mergeCaches(existing, incoming).caches));
        for (const cache of [
          ...incoming.caches,
          ...existing.filter((cache) => cache.sources.length === 0),
        ]) {
          expect(merged.has(cache.code)).toBe(true);
        }
      }),
    );
  });
});
