import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
import { distanceMeters } from './geo';
import { orderPath, shortenLoop } from './orderPath';
import { type PlanePoint, projectToPlane } from './projection';
import { pointsNear } from './trails.test-support';

function planeLength(plane: readonly PlanePoint[]): number {
  let total = 0;
  for (let index = 1; index < plane.length; index++) {
    total += Math.hypot(
      plane[index].x - plane[index - 1].x,
      plane[index].y - plane[index - 1].y,
    );
  }
  return total;
}

/** Plane length of the path after reversing ordered[start ..= end]. */
function lengthAfterReversal(
  plane: readonly PlanePoint[],
  { start, end }: { start: number; end: number },
): number {
  return planeLength([
    ...plane.slice(0, start),
    ...plane.slice(start, end + 1).reverse(),
    ...plane.slice(end + 1),
  ]);
}

/** The order the result came in, as positions into the input, so plane coordinates line up. */
function orderedPlane(
  points: readonly Coordinates[],
  maxMoveEvaluations?: number,
): PlanePoint[] {
  const plane = projectToPlane(points);
  const indexed = points.map((point, index) => ({ ...point, index }));
  return orderPath(indexed, { maxMoveEvaluations }).map(
    (point) => plane[point.index],
  );
}

/** Plane length of the round trip: the path and the way back to its first point. */
function tourLength(plane: readonly PlanePoint[]): number {
  return planeLength([...plane, plane[0]]);
}

/** The round trip's order, as plane points of the input. */
function shortenedPlane(
  points: readonly Coordinates[],
  maxMoveEvaluations?: number,
): PlanePoint[] {
  const plane = projectToPlane(points);
  const indexed = points.map((point, index) => ({ ...point, index }));
  return shortenLoop(indexed, { maxMoveEvaluations }).map(
    (point) => plane[point.index],
  );
}

const smallSets = pointsNear({ minLength: 1, maxLength: 25, spanMeters: 2000 });

describe('orderPath, for random point sets', () => {
  it('returns a permutation of its input', () => {
    fc.assert(
      fc.property(
        smallSets,
        fc.integer({ min: 0, max: 50 }),
        (points, budget) => {
          const indexed = points.map((point, index) => ({ ...point, index }));
          const ordered = orderPath(indexed, {
            maxMoveEvaluations: budget,
          }).map((point) => point.index);
          expect([...ordered].sort((a, b) => a - b)).toEqual(
            indexed.map((point) => point.index),
          );
        },
      ),
    );
  });

  it('is never longer than the nearest-neighbour path it starts from', () => {
    fc.assert(
      fc.property(
        smallSets,
        fc.integer({ min: 0, max: 400 }),
        (points, budget) => {
          const nearestNeighbour = planeLength(orderedPlane(points, 0));
          expect(planeLength(orderedPlane(points, budget))).toBeLessThanOrEqual(
            nearestNeighbour + 1e-6,
          );
          expect(planeLength(orderedPlane(points))).toBeLessThanOrEqual(
            nearestNeighbour + 1e-6,
          );
        },
      ),
    );
  });

  it('ends at a 2-opt optimum: no segment reversal, ends included, shortens the path', () => {
    fc.assert(
      fc.property(smallSets, (points) => {
        const plane = orderedPlane(points);
        const length = planeLength(plane);
        for (let start = 0; start < plane.length; start++) {
          for (let end = start + 1; end < plane.length; end++) {
            expect(
              lengthAfterReversal(plane, { start, end }),
            ).toBeGreaterThanOrEqual(length - 1e-6);
          }
        }
      }),
    );
  });
});

describe('shortenLoop, for random point sets', () => {
  it('keeps the first point first and returns a permutation of its input', () => {
    fc.assert(
      fc.property(
        smallSets,
        fc.integer({ min: 0, max: 50 }),
        (points, budget) => {
          const indexed = points.map((point, index) => ({ ...point, index }));
          const loop = shortenLoop(indexed, { maxMoveEvaluations: budget }).map(
            (point) => point.index,
          );
          expect(loop[0]).toBe(0);
          expect([...loop].sort((a, b) => a - b)).toEqual(
            indexed.map((point) => point.index),
          );
        },
      ),
    );
  });

  it('is never a longer round trip than the order it starts from', () => {
    fc.assert(
      fc.property(
        smallSets,
        fc.integer({ min: 0, max: 400 }),
        (points, budget) => {
          const given = tourLength(projectToPlane(points));
          expect(
            tourLength(shortenedPlane(points, budget)),
          ).toBeLessThanOrEqual(given + 1e-6);
        },
      ),
    );
  });

  it('ends at a 2-opt optimum of the round trip: no segment reversal shortens it', () => {
    fc.assert(
      fc.property(smallSets, (points) => {
        const plane = shortenedPlane(points);
        const length = tourLength(plane);
        for (let start = 0; start < plane.length; start++) {
          for (let end = start + 1; end < plane.length; end++) {
            expect(
              tourLength([
                ...plane.slice(0, start),
                ...plane.slice(start, end + 1).reverse(),
                ...plane.slice(end + 1),
              ]),
            ).toBeGreaterThanOrEqual(length - 1e-6);
          }
        }
      }),
    );
  });
});

interface Indexed extends Coordinates {
  index: number;
}

/** Symmetric legs one to three times the straight line, a few without any path. */
function unevenLegs(seed: number): (from: Indexed, to: Indexed) => number {
  return (from, to) => {
    const [low, high] = [from.index, to.index].sort((a, b) => a - b);
    const roll = (low * 31 + high * 17 + seed) % 7;
    return roll === 0 ? Infinity : distanceMeters(from, to) * (1 + roll / 3);
  };
}

function walkedLength(
  ordered: readonly Indexed[],
  legMeters: (from: Indexed, to: Indexed) => number,
  { closed }: { closed: boolean },
): number {
  const legs = ordered
    .slice(1)
    .map((point, index) => legMeters(ordered[index], point));
  if (closed) legs.push(legMeters(ordered[ordered.length - 1], ordered[0]));
  return legs.reduce((total, leg) => total + leg, 0);
}

describe('ordering by walking legs, for random point sets and legs', () => {
  const indexedSets = smallSets.map((points) =>
    points.map((point, index) => ({ ...point, index })),
  );

  it('orders a permutation never walking farther than the plane order', () => {
    fc.assert(
      fc.property(indexedSets, fc.nat(100), (points, seed) => {
        const legMeters = unevenLegs(seed);
        const ordered = orderPath(points, { legMeters });
        expect(
          ordered.map((point) => point.index).sort((a, b) => a - b),
        ).toEqual(points.map((point) => point.index));
        const open = { closed: false };
        expect(walkedLength(ordered, legMeters, open)).toBeLessThanOrEqual(
          walkedLength(orderPath(points), legMeters, open) * (1 + 1e-9),
        );
      }),
    );
  });

  it('shortens a round trip, first point first, never walking farther than the order given', () => {
    fc.assert(
      fc.property(indexedSets, fc.nat(100), (points, seed) => {
        const legMeters = unevenLegs(seed);
        const loop = shortenLoop(points, { legMeters });
        expect(loop[0]).toBe(points[0]);
        expect(loop.map((point) => point.index).sort((a, b) => a - b)).toEqual(
          points.map((point) => point.index),
        );
        const closed = { closed: true };
        expect(walkedLength(loop, legMeters, closed)).toBeLessThanOrEqual(
          walkedLength(points, legMeters, closed) * (1 + 1e-9),
        );
      }),
    );
  });
});
