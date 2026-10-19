import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { distanceMeters } from '../trails/geo';
import { makeCache, pointsNear } from '../trails/trails.test-support';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from '../trails/types';
import { pairKey } from '../trails/walkingDistances';
import { BATCH_SIZE, routingBatches } from './planRouting';

// Dense enough for groups longer than one window, some caches across a river no path crosses.
const anyCaches: fc.Arbitrary<Geocache[]> = pointsNear({
  minLength: 0,
  maxLength: 140,
  spanMeters: 900,
}).chain((positions) =>
  fc.tuple(
    ...positions.map((position, index) =>
      fc.boolean().map((acrossRiver) =>
        makeCache({
          code: `GCP${index}`,
          name: acrossRiver ? 'across' : 'here',
          ...position,
        }),
      ),
    ),
  ),
);

const anySettings: fc.Arbitrary<TrailSettings> = fc
  .record({
    minCaches: fc.integer({ min: 2, max: 12 }),
    maxGapMeters: fc.integer({ min: 80, max: 400 }),
    maxWalkKilometers: fc.integer({ min: 1, max: 20 }),
    loopsOnly: fc.boolean(),
    maxReturnMeters: fc.integer({ min: 100, max: 3000 }),
  })
  .map((varied) => ({ ...DEFAULT_TRAIL_SETTINGS, ...varied }));

/** What the router would answer: a little longer than the straight line, no path across the river. */
function answerFor(batch: readonly Geocache[]): [string, number][] {
  return batch.flatMap((cache, index) =>
    batch
      .slice(index + 1)
      .map((other): [string, number] => [
        pairKey(cache, other),
        cache.name === other.name
          ? distanceMeters(cache, other) * 1.25
          : Infinity,
      ]),
  );
}

// Each answer adds an unknown pair, so the pairs among the caches bound the rounds; real runs need a handful.
const MAX_ROUNDS = 200;

describe('routingBatches, answered one request at a time', () => {
  it('runs out of requests, each at most BATCH_SIZE caches, each answer adding a pair', () => {
    fc.assert(
      fc.property(anyCaches, anySettings, (caches, settings) => {
        const routed = new Map<string, number>();
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const [batch] = routingBatches(caches, {
            settings,
            locallyFound: new Set(),
            walkingDistances: routed,
          });
          if (batch === undefined) return;
          expect(batch.length).toBeLessThanOrEqual(BATCH_SIZE);
          const before = routed.size;
          for (const [key, meters] of answerFor(batch)) routed.set(key, meters);
          expect(routed.size).toBeGreaterThan(before);
        }
        throw new Error(`Still asking after ${MAX_ROUNDS} answers`);
      }),
      { numRuns: 60 },
    );
  });
});
