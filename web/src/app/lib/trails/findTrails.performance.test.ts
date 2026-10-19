import { describe, expect, it } from 'vitest';

import { MAX_IMPORT_CACHES } from '../geocache/importFiles';
import { findTrails } from './findTrails';
import { distanceMeters } from './geo';
import {
  DEGREES_PER_METER,
  makeCache,
  meanderingTrail,
  randomSequence,
} from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS } from './types';
import { pairKey } from './walkingDistances';

describe('findTrails at the largest realistic import', () => {
  it('handles 10,000 caches, one trail of 1,500 among them, within a generous bound', () => {
    const random = randomSequence(2026);
    const trails = Array.from({ length: 50 }, (_, index) =>
      meanderingTrail(`GCR${index}X`, { count: 120, random }),
    ).flat();
    const longTrail = meanderingTrail('GCLONG', { count: 1500, random });
    const scattered = Array.from(
      { length: 10_000 - trails.length - longTrail.length },
      (_, index) =>
        makeCache({
          code: `GCS${index}`,
          latitude: 47 + random() * 2.7,
          longitude: 8 + random() * 4,
        }),
    );
    const settings = { ...DEFAULT_TRAIL_SETTINGS, maxWalkKilometers: 1000 };

    const started = performance.now();
    const found = findTrails([...scattered, ...trails, ...longTrail], {
      settings,
      locallyFound: new Set(),
    });
    const elapsed = performance.now() - started;

    expect(found.some((trail) => trail.caches.length >= 1500)).toBe(true);
    // Measured 0.2 s in Node, 1 s under coverage; the bound catches an all-pairs regression, not jitter.
    expect(elapsed).toBeLessThan(5000);
  }, 30_000);
});

describe('findTrails at the largest import accepted', () => {
  it(`handles ${MAX_IMPORT_CACHES.toLocaleString('en')} caches in one dense group within the start-up budget`, () => {
    // About 120 m apart in a square, so nearly all link into one group: the worst case for ordering.
    const random = randomSequence(34);
    const sideMeters = Math.sqrt(MAX_IMPORT_CACHES) * 120;
    const eastDegreesPerMeter =
      DEGREES_PER_METER / Math.cos((47 * Math.PI) / 180);
    const caches = Array.from({ length: MAX_IMPORT_CACHES }, (_, index) =>
      makeCache({
        code: `GCD${index}`,
        latitude: 47 + random() * sideMeters * DEGREES_PER_METER,
        longitude: 8 + random() * sideMeters * eastDegreesPerMeter,
      }),
    );

    const started = performance.now();
    const found = findTrails(caches, {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: new Set(),
    });
    const elapsed = performance.now() - started;

    expect(found.length).toBeGreaterThan(100);
    // Measured 0.8 s in Node, 6 s under coverage; the bound catches all-pairs work returning, not jitter.
    expect(elapsed).toBeLessThan(20_000);
  }, 60_000);

  it('orders a long trail by its routed legs within a generous bound', () => {
    const chain = meanderingTrail('GCLONG', {
      count: 1500,
      random: randomSequence(7),
    });
    // Routed the way the app asks: every pair within windows of 50 along the trail.
    const walkingDistances = new Map(
      chain.flatMap((cache, index) =>
        chain
          .slice(index + 1, index + 50)
          .map((other) => [
            pairKey(cache, other),
            distanceMeters(cache, other) * 1.2,
          ]),
      ),
    );

    const started = performance.now();
    const [trail] = findTrails(chain, {
      settings: { ...DEFAULT_TRAIL_SETTINGS, maxWalkKilometers: 1000 },
      locallyFound: new Set(),
      walkingDistances,
    });
    const elapsed = performance.now() - started;

    expect(trail.caches).toHaveLength(1500);
    // Measured 0.6 s in Node, 2.6 s under coverage; the bound catches legs measured for every pair, not jitter.
    expect(elapsed).toBeLessThan(15_000);
  }, 60_000);
});
