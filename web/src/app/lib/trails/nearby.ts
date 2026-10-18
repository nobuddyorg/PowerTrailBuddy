import type { Coordinates } from '../geocache/types';
import { distanceMeters } from './geo';
import type { Trail } from './types';

export interface TrailEnd {
  code: string;
  meters: number;
}

/** The end of the trail, first or last cache, closer to `position`; the first on a tie. */
export function nearestEnd(trail: Trail, position: Coordinates): TrailEnd {
  const first = trail.caches[0];
  const last = trail.caches[trail.caches.length - 1];
  const toFirst = distanceMeters(position, first);
  const toLast = distanceMeters(position, last);
  return toLast < toFirst
    ? { code: last.code, meters: toLast }
    : { code: first.code, meters: toFirst };
}

/** Straight-line metres from `position` to the trail's nearest cache. */
export function distanceToTrail(trail: Trail, position: Coordinates): number {
  return Math.min(
    ...trail.caches.map((cache) => distanceMeters(position, cache)),
  );
}
