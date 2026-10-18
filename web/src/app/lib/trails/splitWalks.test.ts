import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
import { distanceMeters, pathMeters } from './geo';
import { splitWalks, type WalkLimits } from './splitWalks';
import { eastwardChain, pointsNear } from './trails.test-support';

function walkMeters(
  walk: readonly Coordinates[],
  detourFactor: number,
): number {
  return (
    (pathMeters(walk) + distanceMeters(walk[walk.length - 1], walk[0])) *
    detourFactor
  );
}

const chain = eastwardChain(
  { latitude: 51, longitude: 7 },
  { count: 6, spacingMeters: 100 },
);

describe('splitWalks', () => {
  it('returns nothing for nothing', () => {
    expect(splitWalks([], { maxWalkMeters: 1000, detourFactor: 1 })).toEqual(
      [],
    );
  });

  it('keeps a path that fits in one walk', () => {
    expect(
      splitWalks(chain, { maxWalkMeters: 10_000, detourFactor: 1.3 }),
    ).toEqual([chain]);
  });

  it('counts the way back to the start and the detour factor', () => {
    // Out 300 m and back 300 m is 600 m straight; 900 m with a detour factor of 1.5.
    expect(
      splitWalks(chain, { maxWalkMeters: 901, detourFactor: 1.5 }),
    ).toEqual([chain.slice(0, 4), chain.slice(4)]);
    expect(
      splitWalks(chain, { maxWalkMeters: 899, detourFactor: 1.5 }),
    ).toEqual([chain.slice(0, 3), chain.slice(3, 6)]);
  });

  it('allows a walk exactly as long as the limit', () => {
    const limit = walkMeters(chain.slice(0, 3), 1.3);
    expect(
      splitWalks(chain, { maxWalkMeters: limit, detourFactor: 1.3 }),
    ).toEqual([chain.slice(0, 3), chain.slice(3, 6)]);
  });

  it('starts each new walk with a fresh length', () => {
    // Two caches 100 m apart are 200 m there and back; three are 400 m.
    const limits = { maxWalkMeters: 250, detourFactor: 1 };
    expect(splitWalks(chain, limits)).toEqual([
      chain.slice(0, 2),
      chain.slice(2, 4),
      chain.slice(4, 6),
    ]);
  });

  it('makes a lone cache its own walk when even the next step is too long', () => {
    expect(
      splitWalks(chain.slice(0, 3), { maxWalkMeters: 10, detourFactor: 1 }),
    ).toEqual([[chain[0]], [chain[1]], [chain[2]]]);
  });
});

describe('splitWalks, for random ordered paths', () => {
  const anyLimits: fc.Arbitrary<WalkLimits> = fc.record({
    maxWalkMeters: fc.double({ min: 0, max: 8000, noNaN: true }),
    detourFactor: fc.double({ min: 1, max: 2, noNaN: true }),
  });
  const anyPath = pointsNear({ minLength: 0, maxLength: 40, spanMeters: 3000 });

  it('cuts the path into consecutive pieces, losing and repeating nothing', () => {
    fc.assert(
      fc.property(anyPath, anyLimits, (path, limits) => {
        expect(splitWalks(path, limits).flat()).toEqual(path);
      }),
    );
  });

  it('keeps every walk within the limit unless it is a single cache', () => {
    fc.assert(
      fc.property(anyPath, anyLimits, (path, limits) => {
        for (const walk of splitWalks(path, limits)) {
          expect(
            walk.length === 1 ||
              walkMeters(walk, limits.detourFactor) <= limits.maxWalkMeters,
          ).toBe(true);
        }
      }),
    );
  });

  it('is greedy: the next cache would have pushed each walk over the limit', () => {
    fc.assert(
      fc.property(anyPath, anyLimits, (path, limits) => {
        const walks = splitWalks(path, limits);
        walks.slice(0, -1).forEach((walk, index) => {
          const extended = [...walk, walks[index + 1][0]];
          expect(walkMeters(extended, limits.detourFactor)).toBeGreaterThan(
            limits.maxWalkMeters,
          );
        });
      }),
    );
  });
});
