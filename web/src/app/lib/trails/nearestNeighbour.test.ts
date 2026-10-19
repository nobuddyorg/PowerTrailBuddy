import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  nearestNeighbourOrder,
  nearestOthers,
  planeDistance,
  type NeighbourSearch,
} from './nearestNeighbour';
import type { PlanePoint } from './projection';

function planeOf(xy: readonly (readonly [number, number])[]): PlanePoint[] {
  return xy.map(([x, y]) => ({ x, y }));
}

const NO_LIMIT = Number.MAX_SAFE_INTEGER;

/** The nearest unvisited point each step: the plane order before the sweep, every pair compared. */
function allPairsOrder(plane: readonly PlanePoint[], start: number): number[] {
  const order = [start];
  const remaining = plane
    .map((_, position) => position)
    .filter((position) => position !== start);
  while (remaining.length > 0) {
    const current = order[order.length - 1];
    let nearest = 0;
    for (let candidate = 1; candidate < remaining.length; candidate++) {
      if (
        planeDistance(plane[current], plane[remaining[candidate]]) <
        planeDistance(plane[current], plane[remaining[nearest]])
      )
        nearest = candidate;
    }
    order.push(...remaining.splice(nearest, 1));
  }
  return order;
}

function nearestFirst(
  plane: readonly PlanePoint[],
  search: Partial<NeighbourSearch> = {},
): number[] {
  return nearestNeighbourOrder(plane, {
    start: 0,
    count: 1,
    choose: () => 0,
    maxEvaluations: NO_LIMIT,
    ...search,
  });
}

// Whole meters on a small grid, so equal distances, shared positions and shared columns are common.
const gridPoints = fc.array(
  fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })),
  { minLength: 1, maxLength: 30 },
);

describe('nearestNeighbourOrder', () => {
  it('takes the same nearest point as comparing every pair, the earlier on a tie', () => {
    fc.assert(
      fc.property(gridPoints, fc.nat(), (xy, startSeed) => {
        const plane = planeOf(xy);
        const start = startSeed % plane.length;
        expect(nearestFirst(plane, { start })).toEqual(
          allPairsOrder(plane, start),
        );
      }),
    );
  });

  it('goes on to the earlier of two points equally near, whichever side of the sweep each is on', () => {
    expect(
      nearestFirst(
        planeOf([
          [0, 0],
          [3, 4],
          [-5, 0],
        ]),
      ),
    ).toEqual([0, 1, 2]);
    expect(
      nearestFirst(
        planeOf([
          [0, 0],
          [-5, 0],
          [3, 4],
        ]),
      ),
    ).toEqual([0, 1, 2]);
    expect(
      nearestFirst(
        planeOf([
          [0, 0],
          [5, 0],
          [3, -4],
        ]),
      ),
    ).toEqual([0, 1, 2]);
  });

  it('goes on to a point as far east as the nearest so far is away', () => {
    expect(
      nearestFirst(
        planeOf([
          [0, 0],
          [4, 3],
          [5, 0],
        ]),
        { start: 0 },
      ),
    ).toEqual([0, 1, 2]);
    expect(
      nearestFirst(
        planeOf([
          [0, 0],
          [5, 0],
          [4, 3],
        ]),
      ),
    ).toEqual([0, 1, 2]);
  });

  it('measures exactly maxEvaluations distances, then goes on to the next point east, else west', () => {
    // From 0 the nearest is 1; from 1 it takes measuring 2 and 3 to find 3 nearer; from 3 only 2 is left.
    const plane = planeOf([
      [0, 0],
      [1, 0],
      [2, 100],
      [3, 0],
    ]);
    expect(nearestFirst(plane, { maxEvaluations: 3 })).toEqual([0, 1, 3, 2]);
    expect(nearestFirst(plane, { maxEvaluations: 2 })).toEqual([0, 1, 2, 3]);
    expect(nearestFirst(plane, { maxEvaluations: 0 })).toEqual([0, 1, 2, 3]);
    expect(nearestFirst(plane, { start: 3, maxEvaluations: 0 })).toEqual([
      3, 2, 1, 0,
    ]);
    expect(nearestFirst(plane, { start: 1, maxEvaluations: 0 })).toEqual([
      1, 2, 3, 0,
    ]);
  });

  it('chooses among the count nearest, given nearest first', () => {
    const plane = planeOf([
      [0, 0],
      [3, 0],
      [-1, 0],
      [0, 2],
      [10, 10],
    ]);
    const offered: number[][] = [];
    const order = nearestNeighbourOrder(plane, {
      start: 0,
      count: 3,
      choose: (from, nearest) => {
        offered.push([from, ...nearest]);
        return nearest.length - 1;
      },
      maxEvaluations: NO_LIMIT,
    });
    expect(offered[0]).toEqual([0, 2, 3, 1]);
    expect(offered[1]).toEqual([1, 3, 2, 4]);
    expect(order).toEqual([0, 1, 4, 2, 3]);
  });
});

describe('nearestOthers', () => {
  it('lists each point’s count nearest others, nearest first, the earlier position on a tie', () => {
    const plane = planeOf([
      [0, 0],
      [2, 0],
      [-2, 0],
      [0, 1],
      [9, 9],
    ]);
    expect(
      nearestOthers(plane, { count: 2, maxEvaluations: NO_LIMIT }),
    ).toEqual([
      [3, 1],
      [0, 3],
      [0, 3],
      [0, 1],
      [1, 3],
    ]);
  });

  it('agrees with comparing every pair', () => {
    fc.assert(
      fc.property(gridPoints, fc.integer({ min: 1, max: 5 }), (xy, count) => {
        const plane = planeOf(xy);
        const byPairs = plane.map((from, position) =>
          plane
            .map((to, other) => ({ other, meters: planeDistance(from, to) }))
            .filter(({ other }) => other !== position)
            .sort((a, b) => a.meters - b.meters || a.other - b.other)
            .slice(0, count)
            .map(({ other }) => other),
        );
        expect(
          nearestOthers(plane, { count, maxEvaluations: NO_LIMIT }),
        ).toEqual(byPairs);
      }),
    );
  });

  it('stops measuring after maxEvaluations distances in all', () => {
    const plane = planeOf([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    // West to east: 0 measures 1 and 2; 1 measures 0, then 2.
    expect(nearestOthers(plane, { count: 2, maxEvaluations: 3 })).toEqual([
      [1, 2],
      [0],
      [],
    ]);
  });
});
