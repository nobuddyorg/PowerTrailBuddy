import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
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
  return orderPath(indexed, maxMoveEvaluations).map(
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
  return shortenLoop(indexed, maxMoveEvaluations).map(
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
          const ordered = orderPath(indexed, budget).map(
            (point) => point.index,
          );
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
          const loop = shortenLoop(indexed, budget).map((point) => point.index);
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
