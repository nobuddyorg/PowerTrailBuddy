import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { findTrails } from './findTrails';
import {
  DEGREES_PER_METER,
  eastwardChain,
  makeCache,
} from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS, type Trail } from './types';
import { pairKey } from './walkingDistances';

const codesOf = (caches: readonly Geocache[]) =>
  caches.map((cache) => cache.code);

describe('the walking order of findTrails', () => {
  it('is found in the plane, exactly as before walking routes, while no leg is routed', () => {
    // A layout, found by search, where ordering by the estimated legs would differ.
    const eastNorth = [
      [100, 100],
      [100, 200],
      [200, 0],
      [50, 150],
      [50, 100],
      [200, 50],
      [150, 150],
      [100, 0],
      [50, 150],
      [200, 150],
    ];
    const caches = eastNorth.map(([east, north], index) =>
      makeCache({
        code: `GCQ0${index}`,
        latitude: 48 + north * DEGREES_PER_METER,
        longitude:
          11 + (east * DEGREES_PER_METER) / Math.cos((48 * Math.PI) / 180),
      }),
    );
    const [trail] = findTrails(caches, {
      settings: { ...DEFAULT_TRAIL_SETTINGS, minCaches: 2 },
      locallyFound: new Set(),
    });
    expect(codesOf(trail.caches)).toEqual([
      'GCQ01',
      'GCQ08',
      'GCQ03',
      'GCQ04',
      'GCQ00',
      'GCQ06',
      'GCQ09',
      'GCQ05',
      'GCQ02',
      'GCQ07',
    ]);
  });
});

describe('along both banks of a canal bridged only at its ends', () => {
  // Sixteen caches 160 m apart on each bank, 60 m across; routed 5 % longer than straight, crossing on the nearer bridge.
  const spacingMeters = 160;
  const banks = [0, 60].map((northMeters, bank) =>
    eastwardChain(
      { latitude: 48 + northMeters * DEGREES_PER_METER, longitude: 11 },
      { count: 16, spacingMeters },
    ).map((position, index) =>
      makeCache({
        code: `GCK${bank}${String(index + 1).padStart(3, '0')}`,
        ...position,
      }),
    ),
  );
  const caches = banks.flat();
  const bankOf = (cache: Geocache) => cache.code.slice(0, 4);
  const alongMeters = (cache: Geocache) =>
    (caches.indexOf(cache) % 16) * spacingMeters;
  const lastBridgeMeters = 15 * spacingMeters;
  const routed = (a: Geocache, b: Geocache) =>
    bankOf(a) === bankOf(b)
      ? Math.abs(alongMeters(a) - alongMeters(b)) * 1.05
      : Math.min(
          ...[0, lastBridgeMeters].map(
            (bridge) =>
              (Math.abs(alongMeters(a) - bridge) +
                Math.abs(alongMeters(b) - bridge)) *
                1.05 +
              60,
          ),
        );
  const walkingDistances = new Map(
    caches.flatMap((cache, index) =>
      caches
        .slice(index + 1)
        .map((other) => [pairKey(cache, other), routed(cache, other)]),
    ),
  );
  /** Each leg from one bank to the other, as how far along the canal its two caches are. */
  const crossings = (trail: Trail) =>
    trail.caches
      .slice(1)
      .map((cache, index) => [trail.caches[index], cache])
      .filter(([from, to]) => bankOf(from) !== bankOf(to))
      .map((leg) => leg.map(alongMeters));

  it('finds one trail of all 32 caches without routes', () => {
    const trails = findTrails(caches, {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: new Set(),
    });
    expect(trails.map((trail) => trail.caches.length)).toEqual([32]);
  });

  it('walks up one bank and back the other once routed, crossing only on a bridge', () => {
    const [trail, ...rest] = findTrails(caches, {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: new Set(),
      walkingDistances,
    });
    expect(rest).toEqual([]);
    expect(trail.caches).toHaveLength(32);
    expect(crossings(trail)).toEqual([
      [lastBridgeMeters, lastBridgeMeters],
      [0, 0],
    ]);
    expect(trail.walkMeters).toBeLessThan(5500);
  });

  it('closes the same walk into one round trip', () => {
    const trails = findTrails(caches, {
      settings: { ...DEFAULT_TRAIL_SETTINGS, loopsOnly: true },
      locallyFound: new Set(),
      walkingDistances,
    });
    expect(trails.map((trail) => trail.caches.length)).toEqual([32]);
    expect(
      crossings(trails[0]).every(
        ([from, to]) =>
          from === to && (from === 0 || from === lastBridgeMeters),
      ),
    ).toBe(true);
  });
});
