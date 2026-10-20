import type { Geocache } from '../geocache/types';
import { shortenLoop, type OrderOptions } from './orderPath';
import { walkingMeters } from './scoreTrail';
import type { LegMeters } from './walkingDistances';

/** The same round trip, started after its shortest leg, the earliest on a tie: that leg becomes the way back. */
function startAfterShortestLeg(
  loop: readonly Geocache[],
  legMeters: LegMeters,
): Geocache[] {
  let start = 0;
  let shortest = legMeters(loop[loop.length - 1], loop[0]);
  for (let position = 1; position < loop.length; position++) {
    const leg = legMeters(loop[position - 1], loop[position]);
    if (leg < shortest) {
      start = position;
      shortest = leg;
    }
  }
  return [...loop.slice(start), ...loop.slice(0, start)];
}

export interface LoopLegs {
  legMeters: LegMeters;
  /** How the tour is shortened; in the plane when left out. */
  ordering?: OrderOptions<Geocache>;
}

/** A walk reordered to end next to its start: the shorter round trip of the walk as given and its 2-opt tour; non-empty input. */
export function closeLoop(
  walk: readonly Geocache[],
  { legMeters, ordering = {} }: LoopLegs,
): Geocache[] {
  const shortened = shortenLoop(walk, ordering);
  const shorter =
    walkingMeters(shortened, legMeters) < walkingMeters(walk, legMeters)
      ? shortened
      : walk;
  return startAfterShortestLeg(shorter, legMeters);
}

/** Every walk as a round trip, keeping those whose way back is at most maxReturnMeters. */
export function roundTrips(
  walks: readonly Geocache[][],
  {
    maxReturnMeters,
    legMeters,
    ordering,
  }: LoopLegs & { maxReturnMeters: number },
): Geocache[][] {
  return walks
    .map((walk) => closeLoop(walk, { legMeters, ordering }))
    .filter(
      (loop) => legMeters(loop[loop.length - 1], loop[0]) <= maxReturnMeters,
    );
}
