import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { findTrails } from './findTrails';
import {
  DEGREES_PER_METER,
  eastwardChain,
  makeCache,
} from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './types';

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
    expect(findTrails([], DEFAULT_TRAIL_SETTINGS, nothingFoundHere)).toEqual(
      [],
    );
  });

  it('finds a chain of quick caches as one trail in walking order', () => {
    const chain = chainOfCaches('GCA', {
      latitude: 48,
      longitude: 11,
      count: 12,
      spacingMeters: 200,
    });
    const [trail, ...rest] = findTrails(
      [...chain].reverse(),
      DEFAULT_TRAIL_SETTINGS,
      nothingFoundHere,
    );
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
      findTrails(
        [...nine, ...ten],
        DEFAULT_TRAIL_SETTINGS,
        nothingFoundHere,
      ).map((trail) => trail.id),
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
      findTrails([...west, ...east], settings, nothingFoundHere),
    ).toHaveLength(2);
    expect(
      findTrails(
        [...west, ...east],
        { ...settings, maxGapMeters: 320 },
        nothingFoundHere,
      ),
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
    const trails = findTrails(chain, DEFAULT_TRAIL_SETTINGS, nothingFoundHere);
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
    const [trail] = findTrails(
      chain,
      DEFAULT_TRAIL_SETTINGS,
      new Set(['GCL011']),
    );
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
    expect(findTrails(chain, DEFAULT_TRAIL_SETTINGS, nothingFoundHere)).toEqual(
      [],
    );
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
    const trails = findTrails(chain, settings, nothingFoundHere);
    expect(trails.map((trail) => trail.caches.length)).toEqual([10, 10]);
    for (const trail of trails)
      expect(trail.walkMeters).toBeLessThanOrEqual(5000);
    const withRemainder = findTrails(
      chain,
      { ...settings, minCaches: 5 },
      nothingFoundHere,
    );
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
    const trails = findTrails(
      chain,
      { ...DEFAULT_TRAIL_SETTINGS, minCaches: 1, maxGapMeters: 100 },
      nothingFoundHere,
    );
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
      findTrails(
        [...sparse, ...dense, ...sparseTwin],
        settings,
        nothingFoundHere,
      ).map((trail) => trail.id),
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
      findTrails([...small, ...large], settings, nothingFoundHere).map(
        (trail) => trail.id,
      ),
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
    const trails = findTrails(caches, settings, nothingFoundHere);
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
    const trails = findTrails(
      [...dateLine, ...arctic],
      DEFAULT_TRAIL_SETTINGS,
      nothingFoundHere,
    );
    expect(trails.map((trail) => trail.caches.length)).toEqual([12, 12]);
    for (const trail of trails)
      expect(trail.pathMeters).toBeCloseTo(11 * 150, 0);
  });
});
