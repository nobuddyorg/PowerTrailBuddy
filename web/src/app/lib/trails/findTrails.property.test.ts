import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CacheType, Geocache } from '../geocache/types';
import { findTrails } from './findTrails';
import { makeCache, pointsNear } from './trails.test-support';
import type { TrailSettings } from './types';

const cacheTypes: CacheType[] = [
  'traditional',
  'multi',
  'mystery',
  'virtual',
  'event',
];
const mostly = (value: boolean) =>
  fc.integer({ min: 0, max: 9 }).map((roll) => (roll === 0 ? !value : value));
const rating = (maxHalves: number) =>
  fc.integer({ min: 2, max: maxHalves }).map((halves) => halves / 2);

// Mostly quick traditionals a few hundred meters apart, so most runs find trails and some caches fail a filter.
const anyCaches: fc.Arbitrary<Geocache[]> = pointsNear({
  minLength: 0,
  maxLength: 60,
  spanMeters: 600,
}).chain((positions) =>
  fc.tuple(
    ...positions.map((position, index) =>
      fc
        .record({
          type: fc.oneof(
            { arbitrary: fc.constant<CacheType>('traditional'), weight: 4 },
            { arbitrary: fc.constantFrom(...cacheTypes), weight: 1 },
          ),
          difficulty: rating(6),
          terrain: rating(6),
          available: mostly(true),
          archived: mostly(false),
          found: mostly(false),
        })
        .map((attributes) =>
          makeCache({
            ...position,
            ...attributes,
            code: `GCP${index.toString(36).toUpperCase()}`,
          }),
        ),
    ),
  ),
);

const anySettings: fc.Arbitrary<TrailSettings> = fc.record({
  cacheTypes: fc
    .subarray(cacheTypes.slice(1))
    .chain((others) =>
      fc.constantFrom(
        ['traditional', ...others],
        others.length > 0 ? others : cacheTypes,
      ),
    ),
  maxDifficulty: rating(10),
  maxTerrain: rating(10),
  maxGapMeters: fc.integer({ min: 50, max: 600 }),
  minCaches: fc.integer({ min: 1, max: 8 }),
  maxWalkKilometers: fc.double({ min: 0.2, max: 8, noNaN: true }),
  walkingSpeedKmh: fc.double({ min: 2, max: 6, noNaN: true }),
  minutesPerCache: fc.integer({ min: 1, max: 10 }),
  detourFactor: fc.double({ min: 1, max: 2, noNaN: true }),
});

const anyLocallyFound = (caches: readonly Geocache[]) =>
  fc
    .subarray(
      caches.map((cache) => cache.code),
      { maxLength: Math.min(3, caches.length) },
    )
    .map((codes) => new Set(codes));

const anyInput = fc
  .tuple(anyCaches, anySettings)
  .chain(([caches, settings]) =>
    fc.tuple(
      fc.constant(caches),
      fc.constant(settings),
      anyLocallyFound(caches),
    ),
  );

describe('findTrails, for random caches and settings', () => {
  it('gives the same trails whatever order the caches come in', () => {
    fc.assert(
      fc.property(
        anyInput.chain(([caches, settings, found]) =>
          fc.tuple(
            fc.constant(caches),
            fc.shuffledSubarray(caches, { minLength: caches.length }),
            fc.constant(settings),
            fc.constant(found),
          ),
        ),
        ([caches, shuffled, settings, found]) => {
          expect(findTrails(shuffled, settings, found)).toEqual(
            findTrails(caches, settings, found),
          );
        },
      ),
    );
  });

  it('never includes a cache a filter rejects, and uses each cache at most once', () => {
    fc.assert(
      fc.property(anyInput, ([caches, settings, locallyFound]) => {
        const used = findTrails(caches, settings, locallyFound).flatMap(
          (trail) => trail.caches,
        );
        for (const cache of used) {
          expect(settings.cacheTypes).toContain(cache.type);
          expect(cache.difficulty).toBeLessThanOrEqual(settings.maxDifficulty);
          expect(cache.terrain).toBeLessThanOrEqual(settings.maxTerrain);
          expect(cache).toMatchObject({
            available: true,
            archived: false,
            found: false,
          });
          expect(locallyFound.has(cache.code)).toBe(false);
        }
        expect(new Set(used.map((cache) => cache.code)).size).toBe(used.length);
      }),
    );
  });

  it('keeps every trail within maxWalkKilometers and at least minCaches, unless it is a single cache', () => {
    fc.assert(
      fc.property(anyInput, ([caches, settings, locallyFound]) => {
        for (const trail of findTrails(caches, settings, locallyFound)) {
          expect(trail.caches.length).toBeGreaterThanOrEqual(
            settings.minCaches,
          );
          if (trail.caches.length > 1)
            expect(trail.walkMeters).toBeLessThanOrEqual(
              settings.maxWalkKilometers * 1000,
            );
        }
      }),
    );
  });

  it('lists trails by caches per hour, best first', () => {
    fc.assert(
      fc.property(anyInput, ([caches, settings, locallyFound]) => {
        const rates = findTrails(caches, settings, locallyFound).map(
          (trail) => trail.cachesPerHour,
        );
        expect(rates).toEqual([...rates].sort((a, b) => b - a));
      }),
    );
  });
});
