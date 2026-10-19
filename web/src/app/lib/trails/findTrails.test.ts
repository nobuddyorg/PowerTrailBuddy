import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { findTrails } from './findTrails';
import {
  DEGREES_PER_METER,
  eastwardChain,
  makeCache,
} from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './types';
import { BARRIER_FACTOR, pairKey } from './walkingDistances';

const nothingFoundHere = new Set<string>();

/** count caches due east of start, coded prefix001, prefix002, … */
function chainOfCaches(
  prefix: string,
  {
    latitude,
    longitude,
    count,
    spacingMeters,
  }: {
    latitude: number;
    longitude: number;
    count: number;
    spacingMeters: number;
  },
): Geocache[] {
  return eastwardChain({ latitude, longitude }, { count, spacingMeters }).map(
    (position, index) =>
      makeCache({
        code: `${prefix}${String(index + 1).padStart(3, '0')}`,
        ...position,
      }),
  );
}

function codesOf(caches: readonly Geocache[]): string[] {
  return caches.map((cache) => cache.code);
}

describe('findTrails', () => {
  it('finds nothing in nothing', () => {
    expect(
      findTrails([], {
        settings: DEFAULT_TRAIL_SETTINGS,
        locallyFound: nothingFoundHere,
      }),
    ).toEqual([]);
  });

  it('finds a chain of quick caches as one trail in walking order', () => {
    const chain = chainOfCaches('GCA', {
      latitude: 48,
      longitude: 11,
      count: 12,
      spacingMeters: 200,
    });
    const [trail, ...rest] = findTrails([...chain].reverse(), {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: nothingFoundHere,
    });
    expect(rest).toEqual([]);
    expect([codesOf(chain), codesOf(chain).reverse()]).toContainEqual(
      codesOf(trail.caches),
    );
    expect(trail.id).toBe('GCA001-12');
    expect(trail.pathMeters).toBeCloseTo(11 * 200, 3);
    expect(trail.shape).toBe('line');
  });

  it('ignores groups smaller than minCaches, but keeps one exactly that size', () => {
    const nine = chainOfCaches('GCN', {
      latitude: 48,
      longitude: 11,
      count: 9,
      spacingMeters: 200,
    });
    const ten = chainOfCaches('GCT', {
      latitude: 49,
      longitude: 11,
      count: 10,
      spacingMeters: 200,
    });
    expect(
      findTrails([...nine, ...ten], {
        settings: DEFAULT_TRAIL_SETTINGS,
        locallyFound: nothingFoundHere,
      }).map((trail) => trail.id),
    ).toEqual(['GCT001-10']);
  });

  it('breaks a chain at a gap of maxGapMeters or more', () => {
    const west = chainOfCaches('GCW', {
      latitude: 48,
      longitude: 11,
      count: 10,
      spacingMeters: 200,
    });
    const east = chainOfCaches('GCE', {
      latitude: 48,
      longitude:
        west[9].longitude +
        (310 * DEGREES_PER_METER) / Math.cos((48 * Math.PI) / 180),
      count: 10,
      spacingMeters: 200,
    });
    const settings = { ...DEFAULT_TRAIL_SETTINGS, maxGapMeters: 300 };
    expect(
      findTrails([...west, ...east], {
        settings,
        locallyFound: nothingFoundHere,
      }),
    ).toHaveLength(2);
    expect(
      findTrails([...west, ...east], {
        settings: { ...settings, maxGapMeters: 320 },
        locallyFound: nothingFoundHere,
      }),
    ).toHaveLength(1);
  });

  it('leaves out caches the filters reject, which can break a chain', () => {
    const chain = chainOfCaches('GCF', {
      latitude: 48,
      longitude: 11,
      count: 21,
      spacingMeters: 200,
    });
    chain[10] = { ...chain[10], terrain: 4 };
    const trails = findTrails(chain, {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: nothingFoundHere,
    });
    expect(trails.map((trail) => trail.caches.length)).toEqual([10, 10]);
    expect(trails.flatMap((trail) => codesOf(trail.caches))).not.toContain(
      'GCF011',
    );
  });

  it('leaves out caches marked found in the app', () => {
    const chain = chainOfCaches('GCL', {
      latitude: 48,
      longitude: 11,
      count: 11,
      spacingMeters: 200,
    });
    const [trail] = findTrails(chain, {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: new Set(['GCL011']),
    });
    expect(codesOf(trail.caches)).not.toContain('GCL011');
    expect(trail.caches).toHaveLength(10);
  });

  it('finds nothing when every cache is found', () => {
    const chain = chainOfCaches('GCX', {
      latitude: 48,
      longitude: 11,
      count: 15,
      spacingMeters: 200,
    }).map((cache) => ({
      ...cache,
      found: true,
    }));
    expect(
      findTrails(chain, {
        settings: DEFAULT_TRAIL_SETTINGS,
        locallyFound: nothingFoundHere,
      }),
    ).toEqual([]);
  });

  it('splits a long chain into walks within maxWalkKilometers and drops a short remainder', () => {
    // 25 caches 200 m apart: 10 caches are 1.8 km out and back, 3.6 km straight, 4.68 km with the detour factor.
    const chain = chainOfCaches('GCS', {
      latitude: 48,
      longitude: 11,
      count: 25,
      spacingMeters: 200,
    });
    const settings: TrailSettings = {
      ...DEFAULT_TRAIL_SETTINGS,
      maxWalkKilometers: 5,
    };
    const trails = findTrails(chain, {
      settings,
      locallyFound: nothingFoundHere,
    });
    expect(trails.map((trail) => trail.caches.length)).toEqual([10, 10]);
    for (const trail of trails)
      expect(trail.walkMeters).toBeLessThanOrEqual(5000);
    const withRemainder = findTrails(chain, {
      settings: { ...settings, minCaches: 5 },
      locallyFound: nothingFoundHere,
    });
    expect(withRemainder.map((trail) => trail.caches.length)).toEqual([
      5, 10, 10,
    ]);
  });

  it('treats every cache as a trail with minCaches 1 and a gap too small to link', () => {
    const chain = chainOfCaches('GCM', {
      latitude: 48,
      longitude: 11,
      count: 3,
      spacingMeters: 200,
    });
    const trails = findTrails(chain, {
      settings: { ...DEFAULT_TRAIL_SETTINGS, minCaches: 1, maxGapMeters: 100 },
      locallyFound: nothingFoundHere,
    });
    expect(trails.map((trail) => trail.id)).toEqual([
      'GCM001-1',
      'GCM002-1',
      'GCM003-1',
    ]);
  });

  it('ranks by caches per hour, then by size, then by id', () => {
    const dense = chainOfCaches('GCD', {
      latitude: 48,
      longitude: 11,
      count: 10,
      spacingMeters: 100,
    });
    const sparse = chainOfCaches('GCP', {
      latitude: 49,
      longitude: 11,
      count: 10,
      spacingMeters: 250,
    });
    const sparseTwin = chainOfCaches('GCO', {
      latitude: 50,
      longitude: 11,
      count: 10,
      spacingMeters: 250,
    });
    const settings = { ...DEFAULT_TRAIL_SETTINGS, maxWalkKilometers: 1000 };
    expect(
      findTrails([...sparse, ...dense, ...sparseTwin], {
        settings,
        locallyFound: nothingFoundHere,
      }).map((trail) => trail.id),
    ).toEqual(['GCD001-10', 'GCO001-10', 'GCP001-10']);
  });

  it('ranks the larger of two trails with the same rate first', () => {
    // Caches sharing a position need no walking: at one minute each, every trail scores 60 per hour.
    const small = chainOfCaches('GCA', {
      latitude: 48,
      longitude: 11,
      count: 2,
      spacingMeters: 0,
    });
    const large = chainOfCaches('GCZ', {
      latitude: 49,
      longitude: 11,
      count: 3,
      spacingMeters: 0,
    });
    const settings = {
      ...DEFAULT_TRAIL_SETTINGS,
      minCaches: 2,
      minutesPerCache: 1,
    };
    expect(
      findTrails([...small, ...large], {
        settings,
        locallyFound: nothingFoundHere,
      }).map((trail) => trail.id),
    ).toEqual(['GCZ001-3', 'GCA001-2']);
  });

  it('ranks two walks of the same rate and size by id', () => {
    // Exact binary longitude steps tie both walks' rates bit for bit; the walk found first holds the larger codes.
    const step = 2 ** -10;
    const positions = [
      ...Array.from({ length: 20 }, (_, index) => index * step),
      20 * step,
      20.5 * step,
      21 * step,
    ];
    const codes = [
      ...Array.from({ length: 10 }, (_, index) => `GCZ${index}`),
      ...Array.from({ length: 10 }, (_, index) => `GCB${index}`),
      'GCA0',
      'GCA1',
      'GCA2',
    ];
    const caches = positions.map((longitude, index) =>
      makeCache({ code: codes[index], latitude: 0, longitude }),
    );
    const settings = { ...DEFAULT_TRAIL_SETTINGS, maxWalkKilometers: 2.7 };
    const trails = findTrails(caches, {
      settings,
      locallyFound: nothingFoundHere,
    });
    expect(trails.map((trail) => trail.id)).toEqual(['GCB0-10', 'GCZ0-10']);
    expect(trails[0].cachesPerHour).toBe(trails[1].cachesPerHour);
  });

  it('finds a trail across the antimeridian and one near the pole', () => {
    const dateLine = chainOfCaches('GCI', {
      latitude: -17,
      longitude: 179.99,
      count: 12,
      spacingMeters: 150,
    });
    const arctic = chainOfCaches('GCR', {
      latitude: 78.2,
      longitude: 15.6,
      count: 12,
      spacingMeters: 150,
    });
    const trails = findTrails([...dateLine, ...arctic], {
      settings: DEFAULT_TRAIL_SETTINGS,
      locallyFound: nothingFoundHere,
    });
    expect(trails.map((trail) => trail.caches.length)).toEqual([12, 12]);
    for (const trail of trails)
      expect(trail.pathMeters).toBeCloseTo(11 * 150, 0);
  });

  describe('round trips only', () => {
    const chain = chainOfCaches('GCL', {
      latitude: 48,
      longitude: 11,
      count: 12,
      spacingMeters: 200,
    });

    it('walks a chain one way by default, ending at its far end', () => {
      const [trail] = findTrails(chain, {
        settings: DEFAULT_TRAIL_SETTINGS,
        locallyFound: nothingFoundHere,
      });
      expect(trail.returnMeters).toBeCloseTo(11 * 200, 3);
    });

    it('starts the same chain next to where it ends, at no extra walk', () => {
      const [open] = findTrails(chain, {
        settings: DEFAULT_TRAIL_SETTINGS,
        locallyFound: nothingFoundHere,
      });
      const [loop, ...rest] = findTrails(chain, {
        settings: { ...DEFAULT_TRAIL_SETTINGS, loopsOnly: true },
        locallyFound: nothingFoundHere,
      });
      expect(rest).toEqual([]);
      expect(codesOf(loop.caches).sort()).toEqual(codesOf(chain));
      expect(loop.returnMeters).toBeCloseTo(200, 3);
      expect(loop.walkMeters).toBeCloseTo(open.walkMeters, 3);
    });

    it('keeps a round trip whose way back is exactly maxReturnMeters, and drops one beyond', () => {
      const wayBack = 200 * DEFAULT_TRAIL_SETTINGS.detourFactor;
      const trailsWithin = (maxReturnMeters: number) =>
        findTrails(chain, {
          settings: {
            ...DEFAULT_TRAIL_SETTINGS,
            loopsOnly: true,
            maxReturnMeters,
          },
          locallyFound: nothingFoundHere,
          // Every leg routed as the same whole number, so the way back is exact.
          walkingDistances: new Map(
            chain.flatMap((cache, index) =>
              chain
                .slice(index + 1)
                .map((other) => [
                  pairKey(cache, other),
                  Math.round(
                    wayBack * (index + 1 === chain.indexOf(other) ? 1 : 10),
                  ),
                ]),
            ),
          ),
        });
      expect(trailsWithin(Math.round(wayBack))).toHaveLength(1);
      expect(trailsWithin(Math.round(wayBack) - 1)).toEqual([]);
    });
  });

  describe('with routed walking distances', () => {
    // Two rows of six on either side of a motorway, 150 m apart along it and 200 m across.
    const north = chainOfCaches('GCN', {
      latitude: 48.0018,
      longitude: 11,
      count: 6,
      spacingMeters: 150,
    });
    const south = chainOfCaches('GCS', {
      latitude: 48,
      longitude: 11,
      count: 6,
      spacingMeters: 150,
    });
    const settings = { ...DEFAULT_TRAIL_SETTINGS, minCaches: 6 };
    const acrossTheRoad = (meters: number) =>
      new Map(
        north.flatMap((northern) =>
          south.map((southern) => [pairKey(northern, southern), meters]),
        ),
      );

    it('finds both sides as one trail while no route says otherwise', () => {
      const [trail, ...rest] = findTrails([...north, ...south], {
        settings,
        locallyFound: nothingFoundHere,
      });
      expect(rest).toEqual([]);
      expect(trail.caches).toHaveLength(12);
    });

    it('splits the trail where the only way across is a long walk round', () => {
      const barrierMeters =
        BARRIER_FACTOR * settings.maxGapMeters * settings.detourFactor;
      const trails = findTrails([...north, ...south], {
        settings,
        locallyFound: nothingFoundHere,
        walkingDistances: acrossTheRoad(barrierMeters + 1),
      });
      expect(trails.map((trail) => trail.id).sort()).toEqual([
        'GCN001-6',
        'GCS001-6',
      ]);
      const together = findTrails([...north, ...south], {
        settings,
        locallyFound: nothingFoundHere,
        walkingDistances: acrossTheRoad(barrierMeters),
      });
      expect(together.map((trail) => trail.caches.length)).toEqual([12]);
    });

    it('splits it too where no path crosses at all', () => {
      const trails = findTrails([...north, ...south], {
        settings,
        locallyFound: nothingFoundHere,
        walkingDistances: acrossTheRoad(Infinity),
      });
      expect(trails).toHaveLength(2);
    });

    it('measures the walk and its time along the routed legs', () => {
      // Routed 160 m along the row, still shorter than any unrouted leg (300 m times the detour factor) the order could take instead.
      const legs = new Map(
        south
          .slice(1)
          .map((cache, index) => [pairKey(south[index], cache), 160]),
      );
      legs.set(pairKey(south[5], south[0]), 1000);
      const [trail] = findTrails(south, {
        settings,
        locallyFound: nothingFoundHere,
        walkingDistances: legs,
      });
      expect(trail.walkMeters).toBeCloseTo(5 * 160 + 1000, 6);
      expect(trail.durationMinutes).toBeCloseTo(
        (1800 / 1000 / settings.walkingSpeedKmh) * 60 +
          6 * settings.minutesPerCache,
        6,
      );
    });

    it('splits a walk that its routed legs make too long', () => {
      // Straight, all six fit in 1950 m; at 900 m a leg, three and the 390 m way back are 2190 m, four 3285 m.
      const legs = new Map(
        south
          .slice(1)
          .map((cache, index) => [pairKey(south[index], cache), 900]),
      );
      const trails = findTrails(south, {
        settings: { ...settings, minCaches: 2, maxWalkKilometers: 3 },
        locallyFound: nothingFoundHere,
        walkingDistances: legs,
      });
      expect(trails.map((trail) => trail.caches.length)).toEqual([3, 3]);
    });
  });
});
