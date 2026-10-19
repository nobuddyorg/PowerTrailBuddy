import { describe, expect, it } from 'vitest';

import type { Coordinates } from '../geocache/types';
import { pathMeters } from './geo';
import { orderPath, shortenLoop } from './orderPath';
import {
  DEGREES_PER_METER,
  eastwardChain,
  shuffledWithSeed,
} from './trails.test-support';

interface Labelled extends Coordinates {
  label: number;
}

/** Points a few dozen meters apart on the equator, given as [east, north] meters. */
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

describe('orderPath', () => {
  it('returns nothing for nothing, and a lone point as it is', () => {
    expect(orderPath([])).toEqual([]);
    expect(labelsOf(orderPath(onEquator([[5, 5]])))).toEqual([0]);
  });

  it('walks a shuffled straight chain from one end to the other', () => {
    const chain = eastwardChain(
      { latitude: 47, longitude: 9 },
      { count: 30, spacingMeters: 120 },
    ).map((point, label) => ({ ...point, label }));
    const ordered = labelsOf(orderPath(shuffledWithSeed(chain, 42)));
    const expected = chain.map((point) => point.label);
    expect([expected, [...expected].reverse()]).toContainEqual(ordered);
  });

  it('starts at the point farthest from the center, then always takes the nearest unvisited one', () => {
    const points = onEquator([
      [10, 50],
      [40, 10],
      [30, 90],
      [70, 30],
      [20, 90],
    ]);
    expect(labelsOf(orderPath(points, 0))).toEqual([1, 3, 0, 4, 2]);
  });

  it('reverses the start of the path when that shortens it, since the start is free', () => {
    const points = onEquator([
      [10, 50],
      [40, 10],
      [30, 90],
      [70, 30],
      [20, 90],
    ]);
    const improved = orderPath(points, 1);
    expect(labelsOf(improved)).toEqual([3, 1, 0, 4, 2]);
    expect(pathMeters(improved)).toBeLessThan(pathMeters(orderPath(points, 0)));
    expect(labelsOf(orderPath(points))).toEqual([3, 1, 0, 4, 2]);
  });

  it('reverses an inner segment to remove a detour', () => {
    const points = onEquator([
      [90, 10],
      [90, 20],
      [0, 10],
      [80, 90],
      [80, 40],
    ]);
    expect(labelsOf(orderPath(points, 0))).toEqual([2, 4, 1, 0, 3]);
    expect(labelsOf(orderPath(points))).toEqual([2, 0, 1, 4, 3]);
  });

  it('examines exactly maxMoveEvaluations candidate moves, applying each improvement as found', () => {
    const points = onEquator([
      [90, 10],
      [90, 20],
      [0, 10],
      [80, 90],
      [80, 40],
    ]);
    expect(labelsOf(orderPath(points, 3))).toEqual([2, 4, 1, 0, 3]);
    expect(labelsOf(orderPath(points, 4))).toEqual([2, 4, 0, 1, 3]);
    expect(labelsOf(orderPath(points, 5))).toEqual([2, 1, 0, 4, 3]);
    expect(labelsOf(orderPath(points, 11))).toEqual([2, 1, 0, 4, 3]);
    expect(labelsOf(orderPath(points, 12))).toEqual([2, 0, 1, 4, 3]);
  });

  it('starts at the earlier of two points equally far from the center', () => {
    const pair = onEquator([
      [0, 0],
      [100, 0],
    ]);
    expect(labelsOf(orderPath(pair))).toEqual([0, 1]);
    expect(labelsOf(orderPath([...pair].reverse()))).toEqual([1, 0]);
  });

  it('starts at a point farther from the center than the first one, even by less than a meter', () => {
    const points = onEquator([
      [0, 0],
      [0.3, 0],
      [-0.2, 0],
      [-0.1, 0],
    ]);
    expect(labelsOf(orderPath(points, 0))).toEqual([1, 0, 3, 2]);
  });

  it('goes on to the earlier of two points equally near', () => {
    // North and south of the start's parallel, mirrored, so both are exactly as far.
    const points = onEquator([
      [100, 0],
      [0, 0],
      [-100, 1],
      [-100, -1],
    ]);
    expect(labelsOf(orderPath(points, 0))).toEqual([0, 1, 2, 3]);
    const swapped = [points[0], points[1], points[3], points[2]];
    expect(labelsOf(orderPath(swapped, 0))).toEqual([0, 1, 3, 2]);
  });

  it('keeps improving after the first improvement until no reversal helps', () => {
    const points = onEquator([
      [20, 30],
      [50, 60],
      [70, 50],
      [90, 70],
      [80, 10],
      [50, 20],
      [80, 70],
    ]);
    expect(labelsOf(orderPath(points, 0))).toEqual([0, 5, 4, 2, 6, 3, 1]);
    expect(labelsOf(orderPath(points))).toEqual([0, 5, 4, 2, 1, 6, 3]);
  });

  it('orders a chain that crosses the antimeridian without a jump around the world', () => {
    const chain = eastwardChain(
      { latitude: -16, longitude: 179.995 },
      { count: 8, spacingMeters: 150 },
    ).map((point, label) => ({ ...point, label }));
    const ordered = orderPath(shuffledWithSeed(chain, 7));
    expect(pathMeters(ordered)).toBeCloseTo(7 * 150, 0);
  });

  it('handles points sharing a position', () => {
    const points = onEquator([
      [0, 0],
      [0, 0],
      [100, 0],
      [100, 0],
    ]);
    expect(pathMeters(orderPath(points))).toBeCloseTo(100, 3);
  });
});

describe('shortenLoop', () => {
  it('keeps a lone point, and two or three points, as they are', () => {
    const three = onEquator([
      [0, 0],
      [50, 0],
      [0, 50],
    ]);
    expect(labelsOf(shortenLoop(three.slice(0, 1)))).toEqual([0]);
    expect(labelsOf(shortenLoop(three.slice(0, 2)))).toEqual([0, 1]);
    expect(labelsOf(shortenLoop(three))).toEqual([0, 1, 2]);
  });

  it('uncrosses a round trip into a ring, from the first point', () => {
    const crossed = onEquator([
      [0, 0],
      [50, 50],
      [50, 0],
      [0, 50],
    ]);
    expect(labelsOf(shortenLoop(crossed, 0))).toEqual([0, 1, 2, 3]);
    expect(labelsOf(shortenLoop(crossed))).toEqual([0, 2, 1, 3]);
  });

  it('turns a zigzag into a ring', () => {
    const zigzag = onEquator([
      [0, 0],
      [100, 0],
      [0, 10],
      [100, 10],
    ]);
    expect(labelsOf(shortenLoop(zigzag))).toEqual([0, 2, 3, 1]);
  });
});
