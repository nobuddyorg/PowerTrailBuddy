import type { Coordinates, Geocache } from '../geocache/types';
import { distanceMeters } from '../trails/geo';

/** Of the parking spots the caches list, the one closest to `point`; undefined when none lists one. */
export function nearestParking(
  caches: readonly Geocache[],
  point: Coordinates,
): Coordinates | undefined {
  let best: Coordinates | undefined;
  let bestMeters = Infinity;
  for (const { parking } of caches) {
    if (!parking) continue;
    const meters = distanceMeters(parking, point);
    if (meters < bestMeters) {
      best = parking;
      bestMeters = meters;
    }
  }
  return best;
}
