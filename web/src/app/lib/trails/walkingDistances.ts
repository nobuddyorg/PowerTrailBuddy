import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import { distanceMeters } from './geo';

/** Routed walking meters between two caches, by pairKey; Infinity when no path joins them. */
export type WalkingDistances = ReadonlyMap<string, number>;

export const NO_WALKING_DISTANCES: WalkingDistances = new Map();

/** Walking meters from one cache to the next. */
export type LegMeters = (from: Geocache, to: Geocache) => number;

/** A gap whose walk is longer than this many times the largest gap's walk crosses a barrier: a motorway, a river, a fence. */
export const BARRIER_FACTOR = 2;

// Six decimals are about 0.1 m: a cache whose coordinates changed is routed again.
function endpoint(cache: Geocache): string {
  return `${cache.code}@${cache.latitude.toFixed(6)},${cache.longitude.toFixed(6)}`;
}

/** The same key either way round: walking routes are taken as symmetric. */
export function pairKey(a: Geocache, b: Geocache): string {
  const [first, second] = [endpoint(a), endpoint(b)].sort(compareCodes);
  return `${first}|${second}`;
}

/** The routed distance where one is known, else the straight line times the detour factor. */
export function legMetersFor(
  distances: WalkingDistances,
  detourFactor: number,
): LegMeters {
  return (from, to) =>
    distances.get(pairKey(from, to)) ?? distanceMeters(from, to) * detourFactor;
}

/** Whether a gap is walkable: never false without a routed distance, as the straight line is under the largest gap. */
export function isWalkableGap(
  legMeters: LegMeters,
  {
    maxGapMeters,
    detourFactor,
  }: { maxGapMeters: number; detourFactor: number },
): (a: Geocache, b: Geocache) => boolean {
  const limit = BARRIER_FACTOR * maxGapMeters * detourFactor;
  return (a, b) => legMeters(a, b) <= limit;
}
