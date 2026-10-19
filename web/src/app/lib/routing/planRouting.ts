import type { Geocache } from '../geocache/types';
import {
  findTrails,
  orderedGroups,
  type TrailInput,
} from '../trails/findTrails';
import { distanceMeters } from '../trails/geo';
import { gridNeighbourhood } from '../trails/linkComponents';
import { orderPath } from '../trails/orderPath';
import {
  NO_WALKING_DISTANCES,
  pairKey,
  type WalkingDistances,
} from '../trails/walkingDistances';

/** Caches per routing request: one request answers every pair among them. */
export const BATCH_SIZE = 50;

/** Caches each window shares with the next, so legs across a window's edge are routed too. */
export const BATCH_OVERLAP = 10;

type Pair = readonly [Geocache, Geocache];

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

/** The pairs in order, packed into batches of at most BATCH_SIZE distinct caches, a cache shared by two pairs counted once. */
export function packPairs(pairs: readonly Pair[]): Geocache[][] {
  const batches: Geocache[][] = [];
  let batch = new Set<Geocache>();
  for (const pair of pairs) {
    const added = pair.filter((cache) => !batch.has(cache)).length;
    if (batch.size + added > BATCH_SIZE) {
      batches.push([...batch]);
      batch = new Set();
    }
    pair.forEach((cache) => batch.add(cache));
  }
  if (batch.size > 0) batches.push([...batch]);
  return batches;
}

/** Every unrouted pair closer than maxGapMeters, through the grid: each one links on its estimate alone. */
function unroutedLinks(
  caches: readonly Geocache[],
  {
    maxGapMeters,
    distances,
  }: { maxGapMeters: number; distances: WalkingDistances },
): Pair[] {
  const near = gridNeighbourhood(caches, maxGapMeters);
  return caches.flatMap((cache, position) =>
    near(position)
      .filter(
        (other) =>
          other > position &&
          distanceMeters(cache, caches[other]) < maxGapMeters &&
          !distances.has(pairKey(cache, caches[other])),
      )
      .map((other): Pair => [cache, caches[other]]),
  );
}

/** Each leg of a trail, the way back first. */
function legsOf(caches: readonly Geocache[]): Pair[] {
  const previous = [caches[caches.length - 1], ...caches];
  return caches.map((cache, index) => [previous[index], cache]);
}

/** Every leg of every trail, way back included, that is still unrouted. */
function unroutedLegs(
  caches: readonly Geocache[],
  input: TrailInput,
  distances: WalkingDistances,
): Pair[] {
  return findTrails(caches, input)
    .flatMap((trail) => legsOf(trail.caches))
    .filter(([from, to]) => !distances.has(pairKey(from, to)));
}

/** The requests still needed to route the gaps, links and legs of every group big enough for a trail; none once all are known. */
export function routingBatches(
  caches: readonly Geocache[],
  input: TrailInput,
): Geocache[][] {
  const distances = input.walkingDistances ?? NO_WALKING_DISTANCES;
  const { settings } = input;
  const groups = orderedGroups(caches, input).groups.filter(
    (group) => group.length >= settings.minCaches,
  );
  // The routed walking order shifts with every answer; windows cut from it would ask again for pairs already known.
  const along = groups
    .map((group) => orderPath(group))
    .flatMap(windows)
    .filter((batch) => hasUnroutedPair(batch, distances));
  if (along.length > 0) return along;
  // A link between caches far apart in walking order can cross a barrier no window held.
  const links = packPairs(
    unroutedLinks(groups.flat(), {
      maxGapMeters: settings.maxGapMeters,
      distances,
    }),
  );
  if (links.length > 0) return links;
  // Trail legs wait for the gaps and links: until they are routed, the trails they would join may still split.
  return packPairs(unroutedLegs(caches, input, distances));
}
