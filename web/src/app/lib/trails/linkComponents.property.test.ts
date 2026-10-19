import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
import { distanceMeters } from './geo';
import { linkComponents, pointsNear } from './trails.test-support';

/** All pairs, the definition the grid must reproduce. */
function bruteForceComponents(
  points: readonly Coordinates[],
  maxGapMeters: number,
): number[][] {
  const component = points.map((_, index) => index);
  const rootOf = (index: number): number =>
    component[index] === index ? index : rootOf(component[index]);
  points.forEach((a, i) =>
    points.forEach((b, j) => {
      if (distanceMeters(a, b) < maxGapMeters) component[rootOf(i)] = rootOf(j);
    }),
  );
  const groups = new Map<number, number[]>();
  points.forEach((_, index) =>
    groups.set(rootOf(index), [...(groups.get(rootOf(index)) ?? []), index]),
  );
  return normalized([...groups.values()]);
}

function normalized(groups: number[][]): number[][] {
  return groups
    .map((group) => [...group].sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0]);
}

function gridComponents(
  points: readonly Coordinates[],
  maxGapMeters: number,
): number[][] {
  const indexed = points.map((point, index) => ({ ...point, index }));
  return normalized(
    linkComponents(indexed, maxGapMeters).map((group) =>
      group.map((point) => point.index),
    ),
  );
}

describe('linkComponents, for random points anywhere on Earth', () => {
  it('finds exactly the connected components of all pairs closer than the gap', () => {
    fc.assert(
      fc.property(
        pointsNear({ minLength: 0, maxLength: 40, spanMeters: 2000 }),
        fc.double({ min: 1, max: 1500, noNaN: true }),
        (points, gap) => {
          expect(gridComponents(points, gap)).toEqual(
            bruteForceComponents(points, gap),
          );
        },
      ),
    );
  });

  it('agrees with all pairs for gaps from meters to continents', () => {
    fc.assert(
      fc.property(
        pointsNear({ minLength: 0, maxLength: 25, spanMeters: 5_000_000 }),
        fc.double({ min: 1, max: 8_000_000, noNaN: true }),
        (points, gap) => {
          expect(gridComponents(points, gap)).toEqual(
            bruteForceComponents(points, gap),
          );
        },
      ),
    );
  });

  it('returns every point exactly once', () => {
    fc.assert(
      fc.property(
        pointsNear({ minLength: 0, maxLength: 60, spanMeters: 3000 }),
        fc.integer({ min: 1, max: 1000 }),
        (points, gap) => {
          const flattened = gridComponents(points, gap)
            .flat()
            .sort((a, b) => a - b);
          expect(flattened).toEqual(points.map((_, index) => index));
        },
      ),
    );
  });
});
