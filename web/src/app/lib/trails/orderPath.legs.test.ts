import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
import { distanceMeters } from './geo';
import { orderPath, shortenLoop } from './orderPath';
import { DEGREES_PER_METER } from './trails.test-support';

interface Labelled extends Coordinates {
  label: number;
}

/** Points on the equator, given as [east, north] meters. */
function onEquator(meters: readonly (readonly [number, number])[]): Labelled[] {
  return meters.map(([east, north], label) => ({
    label,
    latitude: north * DEGREES_PER_METER,
    longitude: east * DEGREES_PER_METER,
  }));
}

function labelsOf(points: readonly Labelled[]): number[] {
  return points.map((point) => point.label);
}

function lengthOf(
  points: readonly Labelled[],
  legMeters: (from: Labelled, to: Labelled) => number,
): number {
  return points
    .slice(1)
    .reduce(
      (total, point, index) => total + legMeters(points[index], point),
      0,
    );
}

const straight = (from: Labelled, to: Labelled) => distanceMeters(from, to);

describe('orderPath by walking legs', () => {
  // Two banks of eight, 160 m apart along and 60 m across, bridged only at either end; routed 5 % over straight.
  const banks = onEquator(
    [0, 60].flatMap((north) =>
      Array.from({ length: 8 }, (_, along) => [along * 160, north] as const),
    ),
  );
  const bankOf = (point: Labelled) => Math.floor(point.label / 8);
  const alongOf = (point: Labelled) => (point.label % 8) * 160;
  const canal = (from: Labelled, to: Labelled) =>
    bankOf(from) === bankOf(to)
      ? Math.abs(alongOf(from) - alongOf(to)) * 1.05
      : Math.min(
          (alongOf(from) + alongOf(to)) * 1.05 + 60,
          (2 * 7 * 160 - alongOf(from) - alongOf(to)) * 1.05 + 60,
        );
  /** Each leg from one bank to the other, as how far along the canal its two points are. */
  const crossings = (ordered: readonly Labelled[]) =>
    ordered
      .slice(1)
      .map((point, index) => [ordered[index], point])
      .filter(([from, to]) => bankOf(from) !== bankOf(to))
      .map((leg) => leg.map(alongOf));

  it('zigzags across a canal in the plane, where crossing looks short', () => {
    expect(crossings(orderPath(banks)).length).toBeGreaterThan(2);
  });

  it('walks along each bank and crosses only on a bridge by its legs', () => {
    const ordered = orderPath(banks, { legMeters: canal });
    // Along one bank from its middle, over the near bridge, all along the other, and back over the far one.
    expect(crossings(ordered)).toEqual([
      [0, 0],
      [7 * 160, 7 * 160],
    ]);
    expect(lengthOf(ordered, canal)).toBeCloseTo(13 * 160 * 1.05 + 2 * 60, 6);
  });

  it('steps along the bank by its legs before any 2-opt', () => {
    const ordered = orderPath(banks, {
      legMeters: canal,
      maxMoveEvaluations: 0,
    });
    expect(
      crossings(ordered).every(
        ([from, to]) => from === to && (from === 0 || from === 7 * 160),
      ),
    ).toBe(true);
  });

  it('steps on to the plane-nearest of equally long legs', () => {
    const xy = [
      [40, 40],
      [90, 10],
      [20, 60],
      [0, 90],
      [100, 100],
    ] as const;
    // Every leg up to 100 m walks alike.
    const inHundreds = (from: Labelled, to: Labelled) =>
      Math.ceil(
        Math.hypot(
          xy[from.label][0] - xy[to.label][0],
          xy[from.label][1] - xy[to.label][1],
        ) / 100,
      );
    expect(
      labelsOf(
        orderPath(onEquator(xy), {
          legMeters: inHundreds,
          maxMoveEvaluations: 0,
        }),
      ),
    ).toEqual([1, 0, 2, 3, 4]);
  });

  it('keeps the plane order where the order by legs walks as far', () => {
    const points = onEquator([
      [90, 10],
      [90, 20],
      [0, 10],
      [80, 90],
      [80, 40],
    ]);
    // Nearest neighbour gives 2, 4, 1, 0, 3; 2-opt in the plane improves on it, and by these legs neither is shorter.
    const everyLegAlike = () => 1;
    expect(labelsOf(orderPath(points, { legMeters: everyLegAlike }))).toEqual([
      2, 0, 1, 4, 3,
    ]);
  });

  it('keeps the plane order where the order by legs walks farther', () => {
    // Nearest neighbour detours here; the plane order, already 2-opt optimal, is the shorter start.
    const points = onEquator([
      [90, 10],
      [90, 20],
      [0, 10],
      [80, 90],
      [80, 40],
    ]);
    expect(
      labelsOf(
        orderPath(points, { legMeters: straight, maxMoveEvaluations: 0 }),
      ),
    ).toEqual(labelsOf(orderPath(points, { maxMoveEvaluations: 0 })));
    expect(labelsOf(orderPath(points, { legMeters: straight }))).toEqual([
      2, 0, 1, 4, 3,
    ]);
  });

  it('never walks farther by its legs than the plane order does', () => {
    const points = onEquator([
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ]);
    // Between the middle two no path leads, so the order goes round that gap.
    const gapped = (from: Labelled, to: Labelled) =>
      [from.label, to.label].sort().join() === '1,2'
        ? Infinity
        : straight(from, to);
    const ordered = orderPath(points, { legMeters: gapped });
    expect(lengthOf(ordered, gapped)).toBeLessThan(Infinity);
    expect(lengthOf(ordered, gapped)).toBeLessThanOrEqual(
      lengthOf(orderPath(points), gapped),
    );
  });
});

describe('2-opt by walking legs', () => {
  /** Whole meters on a plane of [east, north] points, times a factor of 1 to 3 that each pair keeps either way round. */
  function unevenLegs(xy: readonly (readonly [number, number])[]) {
    return (from: Labelled, to: Labelled) => {
      const [low, high] = [from.label, to.label].sort((a, b) => a - b);
      const [[x1, y1], [x2, y2]] = [xy[low], xy[high]];
      return Math.round(
        Math.hypot(x1 - x2, y1 - y2) * (1 + ((low * 31 + high * 17) % 3)),
      );
    };
  }

  // Found by search: here 2-opt over every move ends elsewhere than over moves joining near points only.
  it('measures only the moves joining a point to one of its eight nearest in the plane, on a path', () => {
    const xy = [
      [6, 91],
      [13, 74],
      [45, 84],
      [46, 56],
      [43, 54],
      [18, 46],
      [68, 51],
      [55, 99],
      [19, 63],
      [70, 25],
    ] as const;
    const ordered = orderPath(onEquator(xy), { legMeters: unevenLegs(xy) });
    expect(labelsOf(ordered)).toEqual([9, 6, 3, 4, 1, 7, 2, 5, 8, 0]);
  });

  // Found by search as well: each turns on a move that only that rule lets through.
  it.each([
    {
      rule: 'a point near the other, though not the other way round',
      order: orderPath,
      xy: [
        [34, 71],
        [74, 49],
        [62, 77],
        [96, 54],
        [55, 3],
        [4, 43],
        [97, 88],
        [66, 84],
        [44, 93],
        [31, 68],
      ],
      expected: [6, 3, 1, 4, 7, 2, 8, 0, 9, 5],
    },
    {
      rule: 'the first point of a path',
      order: orderPath,
      xy: [
        [3, 87],
        [26, 78],
        [63, 28],
        [83, 49],
        [51, 54],
        [97, 0],
        [29, 79],
        [33, 90],
        [99, 18],
        [60, 41],
      ],
      expected: [2, 5, 8, 3, 9, 4, 7, 1, 6, 0],
    },
    {
      rule: 'the way back to the first point of a round trip',
      order: shortenLoop,
      xy: [
        [40, 79],
        [26, 42],
        [21, 95],
        [51, 82],
        [54, 83],
        [52, 2],
        [63, 78],
        [10, 35],
        [75, 1],
        [29, 16],
      ],
      expected: [0, 2, 8, 5, 9, 7, 1, 4, 6, 3],
    },
  ] as const)('joins near points across $rule', ({ order, xy, expected }) => {
    expect(
      labelsOf(order(onEquator(xy), { legMeters: unevenLegs(xy) })),
    ).toEqual(expected);
  });

  it('measures only the moves joining a point to one of its eight nearest in the plane, on a round trip', () => {
    const xy = [
      [17, 23],
      [39, 48],
      [49, 42],
      [40, 100],
      [31, 86],
      [37, 30],
      [10, 47],
      [78, 49],
      [68, 30],
      [12, 87],
      [96, 10],
    ] as const;
    const straightLegs = (from: Labelled, to: Labelled) =>
      Math.round(
        Math.hypot(
          xy[from.label][0] - xy[to.label][0],
          xy[from.label][1] - xy[to.label][1],
        ),
      );
    const loop = shortenLoop(onEquator(xy), { legMeters: straightLegs });
    expect(labelsOf(loop)).toEqual([0, 5, 1, 2, 8, 10, 7, 3, 4, 9, 6]);
  });
});

describe('shortenLoop by walking legs', () => {
  it('leaves out a leg no path walks, however long the legs instead', () => {
    const square = onEquator([
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]);
    const noPathAlongTheBottom = (from: Labelled, to: Labelled) =>
      [from.label, to.label].sort().join() === '0,1'
        ? Infinity
        : straight(from, to);
    expect(labelsOf(shortenLoop(square))).toEqual([0, 1, 2, 3]);
    expect(
      labelsOf(shortenLoop(square, { legMeters: noPathAlongTheBottom })),
    ).toEqual([0, 2, 1, 3]);
  });

  it('measures legs, not plane distance', () => {
    const crossed = onEquator([
      [0, 0],
      [50, 50],
      [50, 0],
      [0, 50],
    ]);
    // Walked, the diagonals are the short way: the crossed loop stays.
    const diagonalsShort = (from: Labelled, to: Labelled) =>
      (from.label + to.label) % 2 === 1 ? 10 : 100;
    expect(labelsOf(shortenLoop(crossed))).toEqual([0, 2, 1, 3]);
    expect(
      labelsOf(shortenLoop(crossed, { legMeters: diagonalsShort })),
    ).toEqual([0, 1, 2, 3]);
  });
});
