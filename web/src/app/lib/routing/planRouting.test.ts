import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { distanceMeters } from '../trails/geo';
import {
  DEGREES_PER_METER,
  eastwardChain,
  makeCache,
} from '../trails/trails.test-support';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from '../trails/types';
import { pairKey } from '../trails/walkingDistances';
import {
  BATCH_OVERLAP,
  BATCH_SIZE,
  packPairs,
  routingBatches,
} from './planRouting';

function chain(prefix: string, count: number, latitude = 48): Geocache[] {
  return eastwardChain(
    { latitude, longitude: 11 },
    { count, spacingMeters: 100 },
  ).map((position, index) =>
    makeCache({
      code: `${prefix}${String(index).padStart(3, '0')}`,
      ...position,
    }),
  );
}

/** Every pair among the caches, as a router would answer them. */
function routedAll(
  caches: readonly Geocache[],
  meters = 120,
): Map<string, number> {
  return new Map(
    caches.flatMap((cache, index) =>
      caches.slice(index + 1).map((other) => [pairKey(cache, other), meters]),
    ),
  );
}

const nothingFound = new Set<string>();
const settings = {
  ...DEFAULT_TRAIL_SETTINGS,
  minCaches: 5,
  maxWalkKilometers: 100,
};

function codesOf(batches: readonly Geocache[][]): string[][] {
  return batches.map((batch) => batch.map((cache) => cache.code));
}

/** Every pair the planner asks for, answered one request at a time as useWalkingDistances does. */
function routeUntilDone(
  caches: readonly Geocache[],
  { settings }: { settings: TrailSettings },
): Map<string, number> {
  const routed = new Map<string, number>();
  for (;;) {
    const [batch] = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
      walkingDistances: routed,
    });
    if (batch === undefined) return routed;
    for (const [key, meters] of routedAll(batch)) routed.set(key, meters);
  }
}

describe('routingBatches', () => {
  it('asks for nothing without caches', () => {
    expect(
      routingBatches([], { settings, locallyFound: nothingFound }),
    ).toEqual([]);
  });

  it('asks for one batch for a group that fits, in walking order', () => {
    const caches = chain('GCA', 12);
    const [batch, ...rest] = routingBatches([...caches].reverse(), {
      settings,
      locallyFound: nothingFound,
    });
    expect(rest).toEqual([]);
    expect([
      caches.map((cache) => cache.code),
      caches.map((cache) => cache.code).reverse(),
    ]).toContainEqual(batch.map((cache) => cache.code));
  });

  it('leaves out groups too small for a trail, and keeps one exactly minCaches big', () => {
    const lonely = chain('GCL', 4, 49);
    expect(
      routingBatches(lonely, { settings, locallyFound: nothingFound }),
    ).toEqual([]);
    const justBigEnough = chain('GCJ', settings.minCaches, 49);
    expect(
      routingBatches(justBigEnough, { settings, locallyFound: nothingFound }),
    ).toHaveLength(1);
  });

  it('covers a long group with overlapping windows, the last one shorter', () => {
    const caches = chain('GCW', 2 * BATCH_SIZE);
    const batches = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
    });
    const step = BATCH_SIZE - BATCH_OVERLAP;
    expect(batches.map((batch) => batch.length)).toEqual([
      BATCH_SIZE,
      BATCH_SIZE,
      2 * BATCH_SIZE - 2 * step,
    ]);
    const order = batches.flat().map((cache) => cache.code);
    expect(order.slice(step, BATCH_SIZE)).toEqual(
      order.slice(BATCH_SIZE, BATCH_SIZE + BATCH_OVERLAP),
    );
    expect(new Set(order).size).toBe(caches.length);
  });

  it('ends with a window exactly reaching the last cache', () => {
    const caches = chain('GCE', BATCH_SIZE);
    expect(
      routingBatches(caches, { settings, locallyFound: nothingFound }),
    ).toHaveLength(1);
  });

  it('skips a window whose pairs are all routed', () => {
    const caches = chain('GCK', 2 * BATCH_SIZE);
    const [first] = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
    });
    const batches = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
      walkingDistances: routedAll(first),
    });
    expect(codesOf(batches)).not.toContainEqual(codesOf([first])[0]);
    expect(batches).toHaveLength(2);
  });

  it('asks for a window again when one pair close enough to link is missing', () => {
    const caches = chain('GCM', 8);
    const routed = routedAll(caches);
    routed.delete(pairKey(caches[2], caches[4]));
    expect(
      codesOf(
        routingBatches(caches, {
          settings,
          locallyFound: nothingFound,
          walkingDistances: routed,
        }),
      ).map((batch) => batch.sort()),
    ).toEqual(codesOf([caches]));
  });

  it('asks no window for a missing pair too far apart to link, a gap exactly the largest included', () => {
    const caches = chain('GCF', 8);
    const routed = routedAll(caches);
    routed.delete(pairKey(caches[0], caches[3]));
    routed.delete(pairKey(caches[1], caches[6]));
    expect(
      routingBatches(caches, {
        settings: {
          ...settings,
          maxGapMeters: distanceMeters(caches[0], caches[3]),
        },
        locallyFound: nothingFound,
        walkingDistances: routed,
      }),
    ).toEqual([]);
  });

  it('asks only for the way back once its window is routed but for that far pair', () => {
    const caches = chain('GCW', 8);
    const routed = routedAll(caches);
    routed.delete(pairKey(caches[0], caches[7]));
    expect(
      codesOf(
        routingBatches(caches, {
          settings,
          locallyFound: nothingFound,
          walkingDistances: routed,
        }),
      ).map((batch) => batch.sort()),
    ).toEqual([['GCW000', 'GCW007']]);
  });

  it('asks nothing again when a cache of a routed trail is marked found', () => {
    const caches = chain('GCN', 3 * BATCH_SIZE);
    const routed = routeUntilDone(caches, { settings });
    expect(
      routingBatches(caches, {
        settings,
        locallyFound: new Set([caches[BATCH_SIZE].code]),
        walkingDistances: routed,
      }),
    ).toEqual([]);
  });

  it('asks only for the windows holding a cache added to a routed trail', () => {
    const caches = chain('GCI', 3 * BATCH_SIZE);
    const routed = routeUntilDone(caches, { settings });
    const added = makeCache({
      code: 'GCI999',
      latitude: caches[5].latitude + 30 * DEGREES_PER_METER,
      longitude: caches[5].longitude,
    });
    const batches = routingBatches([...caches, added], {
      settings,
      locallyFound: nothingFound,
      walkingDistances: routed,
    });
    expect(batches).toHaveLength(1);
    expect(codesOf(batches)[0]).toContain('GCI999');
  });

  it('then asks for the way back of each trail longer than one window, in pairs', () => {
    const caches = chain('GCB', BATCH_SIZE + 20);
    const routed = new Map(
      routingBatches(caches, { settings, locallyFound: nothingFound }).flatMap(
        (batch) => [...routedAll(batch)],
      ),
    );
    const batches = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
      walkingDistances: routed,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    const [last, first] = batches[0];
    expect([first.code, last.code].sort()).toEqual(['GCB000', 'GCB069']);
  });

  it('then asks for every link no window held, each cache once, before any leg', () => {
    // Two rows 250 m apart: a cache links to the one across, far from it in walking order.
    const caches = [
      ...chain('GCU', BATCH_SIZE / 2 + 10),
      ...chain('GCV', BATCH_SIZE / 2 + 10, 48 + 250 * DEGREES_PER_METER),
    ];
    const routed = new Map(
      routingBatches(caches, { settings, locallyFound: nothingFound }).flatMap(
        (batch) => [...routedAll(batch)],
      ),
    );
    const links = caches.flatMap((cache, index) =>
      caches
        .slice(index + 1)
        .filter(
          (other) =>
            distanceMeters(cache, other) < settings.maxGapMeters &&
            !routed.has(pairKey(cache, other)),
        )
        .map((other) => [cache.code, other.code]),
    );
    expect(links.length).toBeGreaterThan(BATCH_SIZE / 2);

    const batches = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
      walkingDistances: routed,
    });
    const linked = new Set(links.flat());
    expect(linked.size).toBeLessThanOrEqual(BATCH_SIZE);
    expect(codesOf(batches).map((batch) => batch.sort())).toEqual([
      [...linked].sort(),
    ]);
  });

  it('asks for no pair exactly maxGapMeters apart, as it never links', () => {
    const west = chain('GCW', settings.minCaches);
    const east = eastwardChain(
      { latitude: 48, longitude: west[west.length - 1].longitude + 0.003 },
      { count: settings.minCaches, spacingMeters: 100 },
    ).map((position, index) => makeCache({ code: `GCZ${index}`, ...position }));
    const apart = {
      ...settings,
      maxGapMeters: distanceMeters(west[west.length - 1], east[0]),
    };
    const caches = [...west, ...east];
    const routed = new Map(
      routingBatches(caches, {
        settings: apart,
        locallyFound: nothingFound,
      }).flatMap((batch) => [...routedAll(batch)]),
    );
    expect(
      routingBatches(caches, {
        settings: apart,
        locallyFound: nothingFound,
        walkingDistances: routed,
      }),
    ).toEqual([]);
  });

  it('then asks for a round trip leg no window held, even where it is not the way back', () => {
    // Out along one row, north at its end and back along another 400 m north: too far to link, near enough to close the loop.
    const out = chain('GCU', BATCH_SIZE / 2 + 10);
    const caches = [
      ...out,
      ...[100, 200, 300].map((north) =>
        makeCache({
          code: `GCC${north}`,
          latitude: 48 + north * DEGREES_PER_METER,
          longitude: out[out.length - 1].longitude,
        }),
      ),
      ...chain('GCV', BATCH_SIZE / 2 + 10, 48 + 400 * DEGREES_PER_METER),
    ];
    const loops = { ...settings, loopsOnly: true };
    const routed = new Map(
      routingBatches(caches, {
        settings: loops,
        locallyFound: nothingFound,
      }).flatMap((batch) => [...routedAll(batch)]),
    );
    const batches = routingBatches(caches, {
      settings: loops,
      locallyFound: nothingFound,
      walkingDistances: routed,
    });
    expect([[['GCU000', 'GCV000']], [['GCU034', 'GCV034']]]).toContainEqual(
      codesOf(batches).map((batch) => batch.sort()),
    );
  });

  it('asks for a group of exactly minCaches', () => {
    const caches = chain('GCM', settings.minCaches);
    const batches = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
    });
    expect(codesOf(batches).map((batch) => batch.sort())).toEqual([
      codesOf([caches])[0],
    ]);
  });

  it('asks for nothing once every gap, leg and way back is routed', () => {
    const caches = chain('GCD', BATCH_SIZE + 20);
    const routed = routedAll(caches);
    expect(
      routingBatches(caches, {
        settings,
        locallyFound: nothingFound,
        walkingDistances: routed,
      }),
    ).toEqual([]);
  });

  it('packs many ways back into batches of BATCH_SIZE caches', () => {
    // More trails than one batch holds ways back for, each longer than a window.
    const trails = Array.from({ length: BATCH_SIZE / 2 + 1 }, (_, index) =>
      chain(
        `GC${index.toString(36).toUpperCase()}X`,
        BATCH_SIZE + 5,
        40 + index,
      ),
    );
    const caches = trails.flat();
    const routed = new Map(
      routingBatches(caches, { settings, locallyFound: nothingFound }).flatMap(
        (batch) => [...routedAll(batch)],
      ),
    );
    const batches = routingBatches(caches, {
      settings,
      locallyFound: nothingFound,
      walkingDistances: routed,
    });
    expect(batches.map((batch) => batch.length)).toEqual([BATCH_SIZE, 2]);
  });
});

describe('packPairs', () => {
  const caches = chain('GCP', BATCH_SIZE + 1);
  const steps = caches
    .slice(1)
    .map((cache, index): [Geocache, Geocache] => [caches[index], cache]);

  it('packs nothing into no batch', () => {
    expect(packPairs([])).toEqual([]);
  });

  it('counts a cache two pairs share once', () => {
    expect(packPairs(steps)).toEqual([
      caches.slice(0, BATCH_SIZE),
      caches.slice(BATCH_SIZE - 1),
    ]);
  });

  it('adds a pair already in a full batch to it', () => {
    const full = steps.slice(0, BATCH_SIZE - 1);
    expect(packPairs([...full, [caches[0], caches[BATCH_SIZE - 1]]])).toEqual([
      caches.slice(0, BATCH_SIZE),
    ]);
  });
});
