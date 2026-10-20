import { describe, expect, it } from 'vitest';

import type { Geocache } from '../geocache/types';
import { orderedGroups } from '../trails/findTrails';
import { distanceMeters } from '../trails/geo';
import { DEGREES_PER_METER, makeCache } from '../trails/trails.test-support';
import { DEFAULT_TRAIL_SETTINGS } from '../trails/types';
import { pairKey } from '../trails/walkingDistances';
import { routingBatches } from './planRouting';
import { MAX_REQUESTS } from './requestPolicy';

const SPACING_METERS = 150;
const RIVER_METERS = 100;
const CROSSING_METERS = 5000;
const DEGREES_PER_METER_EAST =
  DEGREES_PER_METER / Math.cos((48 * Math.PI) / 180);

/** A side × side grid on one bank, its nearest row RIVER_METERS / 2 from the river's middle. */
function bank(prefix: string, side: number, northward: 1 | -1): Geocache[] {
  return Array.from({ length: side * side }, (_, index) => {
    const row = Math.floor(index / side);
    const column = index % side;
    const north = northward * (RIVER_METERS / 2 + row * SPACING_METERS);
    return makeCache({
      code: `${prefix}${String(index).padStart(3, '0')}`,
      latitude: 48 + north * DEGREES_PER_METER,
      longitude: 11 + column * SPACING_METERS * DEGREES_PER_METER_EAST,
    });
  });
}

const northOfRiver = (cache: Geocache) => cache.latitude > 48;

/** The router's answer for a batch: along the bank a little longer than straight, across it the long way to a bridge. */
function routed(batch: readonly Geocache[]): [string, number][] {
  return batch.flatMap((cache, index) =>
    batch
      .slice(index + 1)
      .map((other): [string, number] => [
        pairKey(cache, other),
        northOfRiver(cache) === northOfRiver(other)
          ? distanceMeters(cache, other) * 1.2
          : CROSSING_METERS,
      ]),
  );
}

/** Asks for the first batch and takes the answer, as the hook does, until the planner wants nothing more. */
function routeUntilDone(caches: readonly Geocache[]) {
  const settings = DEFAULT_TRAIL_SETTINGS;
  const distances = new Map<string, number>();
  let requests = 0;
  for (;;) {
    const [next] = routingBatches(caches, {
      settings,
      locallyFound: new Set(),
      walkingDistances: distances,
    });
    if (next === undefined) break;
    expect(next.length).toBeLessThanOrEqual(50);
    requests++;
    for (const [key, meters] of routed(next)) distances.set(key, meters);
  }
  const { groups } = orderedGroups(caches, {
    settings,
    locallyFound: new Set(),
    walkingDistances: distances,
  });
  return { distances, requests, groups };
}

function unroutedLinks(
  caches: readonly Geocache[],
  distances: ReadonlyMap<string, number>,
): string[] {
  return caches.flatMap((cache, index) =>
    caches
      .slice(index + 1)
      .filter(
        (other) =>
          distanceMeters(cache, other) < DEFAULT_TRAIL_SETTINGS.maxGapMeters &&
          !distances.has(pairKey(cache, other)),
      )
      .map((other) => pairKey(cache, other)),
  );
}

describe('routingBatches across a river with no bridge nearby', () => {
  it('routes every link of two grids 8 caches wide, so each bank is a group of its own', () => {
    const side = 8;
    const caches = [...bank('GCN', side, 1), ...bank('GCS', side, -1)];
    const { distances, requests, groups } = routeUntilDone(caches);

    expect(unroutedLinks(caches, distances)).toEqual([]);
    expect(groups.map((group) => group.length)).toEqual([
      side * side,
      side * side,
    ]);
    for (const group of groups)
      expect(new Set(group.map(northOfRiver)).size).toBe(1);
    expect(requests).toBeLessThanOrEqual(MAX_REQUESTS);
  });
});

/** A grid of rows × columns caches SPACING_METERS apart, all on one bank. */
function grid(rows: number, columns: number): Geocache[] {
  return Array.from({ length: rows * columns }, (_, index) =>
    makeCache({
      code: `GCG${String(index).padStart(4, '0')}`,
      latitude:
        48 + Math.floor(index / columns) * SPACING_METERS * DEGREES_PER_METER,
      longitude:
        11 + (index % columns) * SPACING_METERS * DEGREES_PER_METER_EAST,
    }),
  );
}

/** A fixed detour of 5–55 % per pair, so the routed walking order differs from the straight-line one. */
function detourOf(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  return 1.05 + (hash / 1000) * 0.5;
}

describe('routingBatches while answers reorder the walk', () => {
  it('keeps its windows in place, so no answer makes it ask for a window again', () => {
    const caches = grid(6, 20);
    const distances = new Map<string, number>();
    let requests = 0;
    for (;;) {
      const [next] = routingBatches(caches, {
        settings: DEFAULT_TRAIL_SETTINGS,
        locallyFound: new Set(),
        walkingDistances: distances,
      });
      if (next === undefined) break;
      requests++;
      next.forEach((cache, index) =>
        next.slice(index + 1).forEach((other) => {
          const key = pairKey(cache, other);
          distances.set(key, distanceMeters(cache, other) * detourOf(key));
        }),
      );
    }
    // Windows cut from the routed order moved with every answer and asked 14 times.
    expect(requests).toBeLessThanOrEqual(6);
  });
});
