import { describe, expect, it } from 'vitest';

import { findTrails } from './findTrails';
import {
  makeCache,
  meanderingTrail,
  randomSequence,
} from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS } from './types';

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
