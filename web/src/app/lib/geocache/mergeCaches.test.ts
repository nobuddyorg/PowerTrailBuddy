import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { syntheticCache } from './gpx.test-support';
import { mergeCaches } from './mergeCaches';
import type { Geocache } from './types';

const first = syntheticCache(1);
const second = syntheticCache(2);
const third = syntheticCache(3);

const cachesArbitrary = fc
  .array(fc.record({ index: fc.nat({ max: 12 }), found: fc.boolean() }), {
    maxLength: 15,
  })
  .map((specs) =>
    specs.map(({ index, found }) => syntheticCache(index, { found })),
  );

function codes(caches: readonly Geocache[]): string[] {
  return caches.map((cache) => cache.code);
}

describe('mergeCaches', () => {
  it('keeps existing caches first, then appends new ones', () => {
    expect(mergeCaches([first, second], [third])).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('replaces an existing cache with the incoming one of the same code, in place', () => {
    const disabled = { ...first, available: false };
    expect(mergeCaches([first, second], [disabled])).toEqual([
      disabled,
      second,
    ]);
  });

  it('keeps the last of several incoming caches with one code', () => {
    const archived = { ...second, archived: true };
    expect(mergeCaches([], [second, archived])).toEqual([archived]);
  });

  it('returns an empty list for two empty lists', () => {
    expect(mergeCaches([], [])).toEqual([]);
  });

  it('does not change its inputs', () => {
    const existing = [first];
    const incoming = [{ ...first, found: true }];
    mergeCaches(existing, incoming);
    expect([existing, incoming]).toEqual([
      [first],
      [{ ...first, found: true }],
    ]);
  });

  it('is idempotent: merging the same import again changes nothing', () => {
    fc.assert(
      fc.property(cachesArbitrary, cachesArbitrary, (existing, incoming) => {
        const once = mergeCaches(existing, incoming);
        expect(mergeCaches(once, incoming)).toEqual(once);
      }),
    );
  });

  it('holds each code once, every incoming cache as given, and every other existing one', () => {
    fc.assert(
      fc.property(cachesArbitrary, cachesArbitrary, (existing, incoming) => {
        const merged = mergeCaches(existing, incoming);
        const byCode = new Map(merged.map((cache) => [cache.code, cache]));
        expect(byCode.size).toBe(merged.length);
        expect(new Set(codes(merged))).toEqual(
          new Set([...codes(existing), ...codes(incoming)]),
        );
        const lastIncoming = new Map(
          incoming.map((cache) => [cache.code, cache]),
        );
        for (const [code, cache] of lastIncoming) {
          expect(byCode.get(code)).toBe(cache);
        }
      }),
    );
  });
});
