import type { Geocache } from '../geocache/types';
import {
  findTrails,
  orderedGroups,
  type TrailInput,
} from '../trails/findTrails';
import {
  NO_WALKING_DISTANCES,
  pairKey,
  type WalkingDistances,
} from '../trails/walkingDistances';

/** Caches per routing request: one request answers every pair among them. */
export const BATCH_SIZE = 50;

/** Caches each window shares with the next, so legs across a window's edge are routed too. */
export const BATCH_OVERLAP = 10;

function hasUnroutedPair(
  caches: readonly Geocache[],
  distances: WalkingDistances,
): boolean {
  return caches.some((cache, index) =>
    caches
      .slice(index + 1)
      .some((other) => !distances.has(pairKey(cache, other))),
  );
}

/** Overlapping runs of BATCH_SIZE along the walking order, the last one possibly shorter. */
function windows(group: readonly Geocache[]): Geocache[][] {
  const step = BATCH_SIZE - BATCH_OVERLAP;
  const runs: Geocache[][] = [];
  for (let start = 0; ; start += step) {
    runs.push(group.slice(start, start + BATCH_SIZE));
    if (start + BATCH_SIZE >= group.length) return runs;
  }
}

/** Each leg of a trail, the way back first. */
function legsOf(caches: readonly Geocache[]): Geocache[][] {
  const previous = [caches[caches.length - 1], ...caches];
  return caches.map((cache, index) => [previous[index], cache]);
}

/** Every leg of every trail, way back included, that no window held together, two caches each, packed into batches. */
function trailLegBatches(
  caches: readonly Geocache[],
  input: TrailInput,
  distances: WalkingDistances,
): Geocache[][] {
  const legs = findTrails(caches, input)
    .flatMap((trail) => legsOf(trail.caches))
    .filter(([from, to]) => !distances.has(pairKey(from, to)))
    .flat();
  const batches: Geocache[][] = [];
  for (let start = 0; start < legs.length; start += BATCH_SIZE) {
    batches.push(legs.slice(start, start + BATCH_SIZE));
  }
  return batches;
}

/** The requests still needed to route the gaps and legs of every group big enough for a trail; none once all are known. */
export function routingBatches(
  caches: readonly Geocache[],
  input: TrailInput,
): Geocache[][] {
  const distances = input.walkingDistances ?? NO_WALKING_DISTANCES;
  const along = orderedGroups(caches, input)
    .groups.filter((group) => group.length >= input.settings.minCaches)
    .flatMap(windows)
    .filter((batch) => hasUnroutedPair(batch, distances));
  // Trail legs wait for the gaps: until they are routed, the trails they would join may still split.
  return along.length > 0 ? along : trailLegBatches(caches, input, distances);
}
