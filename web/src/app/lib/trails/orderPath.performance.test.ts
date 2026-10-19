import { describe, expect, it } from 'vitest';

import { pathMeters } from './geo';
import { orderPath } from './orderPath';
import {
  meanderingTrail,
  randomSequence,
  shuffledWithSeed,
} from './trails.test-support';

describe('orderPath at the largest realistic size', () => {
  it('orders a single component of 1,500 caches quickly, no longer than nearest neighbour', () => {
    const chain = shuffledWithSeed(
      meanderingTrail('GCLONG', { count: 1500, random: randomSequence(7) }),
      7,
    );

    const started = performance.now();
    const improved = orderPath(chain);
    const elapsed = performance.now() - started;

    expect(pathMeters(improved)).toBeLessThan(
      pathMeters(orderPath(chain, { maxMoveEvaluations: 0 })),
    );
    // Measured 0.13 s in Node, 0.8 s under coverage; the bound catches a complexity regression, not jitter.
    expect(elapsed).toBeLessThan(3000);
  }, 30_000);
});
