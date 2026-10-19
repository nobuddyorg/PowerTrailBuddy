import { describe, expect, it } from 'vitest';

import { distanceMeters } from './geo';
import { makeCache } from './trails.test-support';
import {
  BARRIER_FACTOR,
  isWalkableGap,
  legMetersFor,
  NO_WALKING_DISTANCES,
  pairKey,
} from './walkingDistances';

const here = makeCache({ code: 'GCAAA1', latitude: 48, longitude: 11 });
const there = makeCache({ code: 'GCAAA2', latitude: 48.001, longitude: 11 });

describe('pairKey', () => {
  it('is the same either way round', () => {
    expect(pairKey(here, there)).toBe(pairKey(there, here));
  });

  it('names both caches with their coordinates to six decimals', () => {
    expect(pairKey(there, here)).toBe(
      'GCAAA1@48.000000,11.000000|GCAAA2@48.001000,11.000000',
    );
  });

  it('changes when a cache moves, so a moved cache is routed again', () => {
    const moved = { ...there, latitude: 48.0011 };
    expect(pairKey(here, moved)).not.toBe(pairKey(here, there));
  });
});

describe('legMetersFor', () => {
  it('takes the straight line times the detour factor for a pair with no route', () => {
    expect(legMetersFor(NO_WALKING_DISTANCES, 1.3)(here, there)).toBeCloseTo(
      distanceMeters(here, there) * 1.3,
      9,
    );
  });

  it('takes the routed distance where there is one, either way round', () => {
    const legMeters = legMetersFor(new Map([[pairKey(here, there), 640]]), 1.3);
    expect(legMeters(here, there)).toBe(640);
    expect(legMeters(there, here)).toBe(640);
  });

  it('keeps an unroutable pair infinitely far', () => {
    const legMeters = legMetersFor(
      new Map([[pairKey(here, there), Infinity]]),
      1.3,
    );
    expect(legMeters(here, there)).toBe(Infinity);
  });
});

describe('isWalkableGap', () => {
  const settings = { maxGapMeters: 300, detourFactor: 1.5 };
  const limit = BARRIER_FACTOR * 300 * 1.5;

  it('lets a walk up to the barrier limit link, and not a metre more', () => {
    expect(isWalkableGap(() => limit, settings)(here, there)).toBe(true);
    expect(isWalkableGap(() => limit + 0.001, settings)(here, there)).toBe(
      false,
    );
  });

  it('asks legMeters about exactly the two caches', () => {
    const asked: string[] = [];
    isWalkableGap((from, to) => {
      asked.push(`${from.code}>${to.code}`);
      return 0;
    }, settings)(there, here);
    expect(asked).toEqual(['GCAAA2>GCAAA1']);
  });

  it('never cuts a straight gap under the largest one without a route', () => {
    const near = { ...there, latitude: 48.0026 };
    expect(distanceMeters(here, near)).toBeLessThan(300);
    expect(
      isWalkableGap(
        legMetersFor(NO_WALKING_DISTANCES, settings.detourFactor),
        settings,
      )(here, near),
    ).toBe(true);
  });
});
