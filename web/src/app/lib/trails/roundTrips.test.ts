import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { closeLoop, roundTrips } from './roundTrips';
import { DEGREES_PER_METER, makeCache } from './trails.test-support';
import { legMetersFor, NO_WALKING_DISTANCES } from './walkingDistances';

/** Caches on the equator, given as [east, north] meters, coded GCR0, GCR1, … in input order. */
function onEquator(meters: readonly (readonly [number, number])[]): Geocache[] {
  return meters.map(([east, north], index) =>
    makeCache({
      code: `GCR${index}`,
      latitude: north * DEGREES_PER_METER,
      longitude: east * DEGREES_PER_METER,
    }),
  );
}

function codesOf(caches: readonly Geocache[]): string[] {
  return caches.map((cache) => cache.code);
}

const straightLine = legMetersFor(NO_WALKING_DISTANCES, 1);
// Whole meters, so legs of the same length tie exactly.
const straight = (from: Geocache, to: Geocache) =>
  Math.round(straightLine(from, to));

describe('closeLoop', () => {
  it('keeps a round trip whose legs all tie as it is', () => {
    const square = onEquator([
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
    ]);
    expect(codesOf(closeLoop(square, straight))).toEqual(codesOf(square));
  });

  it('starts after the shortest leg, so that leg is the way back', () => {
    const ring = onEquator([
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 20],
    ]);
    expect(codesOf(closeLoop(ring, straight))).toEqual([
      'GCR3',
      'GCR0',
      'GCR1',
      'GCR2',
    ]);
  });

  it('uncrosses a walk into a ring', () => {
    const crossed = onEquator([
      [0, 0],
      [100, 110],
      [100, 0],
      [0, 100],
    ]);
    expect(codesOf(closeLoop(crossed, straight))).toEqual([
      'GCR0',
      'GCR2',
      'GCR1',
      'GCR3',
    ]);
  });

  it('keeps the order as given unless the new one walks shorter, routed', () => {
    const crossed = onEquator([
      [0, 0],
      [100, 100],
      [100, 0],
      [0, 100],
    ]);
    const everyLegAlike = () => 50;
    expect(codesOf(closeLoop(crossed, everyLegAlike))).toEqual(
      codesOf(crossed),
    );
  });
});

describe('roundTrips', () => {
  it('keeps the round trips whose way back is at most maxReturnMeters', () => {
    const near = onEquator([
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 20],
    ]);
    const far = onEquator([
      [1000, 0],
      [1000, 150],
      [1150, 150],
      [1150, 0],
    ]);
    const kept = roundTrips([near, far], {
      maxReturnMeters: 80,
      legMeters: straight,
    });
    expect(kept.map(codesOf)).toEqual([['GCR3', 'GCR0', 'GCR1', 'GCR2']]);
  });
});
