import { distanceMeters } from '../trails/geo';
import type { Coordinates, Geocache } from './types';

/** An additional waypoint of type Parking Area; its name is upper-cased. */
export interface ParkingArea extends Coordinates {
  name: string;
}

const PARKING_AREA = /(?:^|\|)parking area$/;

/** True for a `<sym>` or `<type>` naming a parking area: 'Parking Area' or 'Waypoint|Parking Area'. */
export function namesParkingArea(text: string): boolean {
  return PARKING_AREA.test(text.trim().toLowerCase());
}

// Geocaching.com names a cache's waypoints by swapping the code's two-letter prefix: GC1ABCD → PK1ABCD.
function suffixOf(name: string): string {
  return name.slice(2);
}

function groupBySuffix(
  parkingAreas: readonly ParkingArea[],
): Map<string, ParkingArea[]> {
  const bySuffix = new Map<string, ParkingArea[]>();
  for (const area of parkingAreas) {
    const suffix = suffixOf(area.name);
    if (suffix === '') continue;
    const group = bySuffix.get(suffix) ?? [];
    group.push(area);
    bySuffix.set(suffix, group);
  }
  return bySuffix;
}

function nearest(
  cache: Coordinates,
  candidates: readonly ParkingArea[],
): Coordinates {
  const { latitude, longitude } = candidates.reduce((best, candidate) =>
    distanceMeters(cache, candidate) < distanceMeters(cache, best)
      ? candidate
      : best,
  );
  return { latitude, longitude };
}

/** Each cache with the nearest of its own parking areas, or without parking when none is given. */
export function withParking(
  caches: readonly Geocache[],
  parkingAreas: readonly ParkingArea[],
): Geocache[] {
  const bySuffix = groupBySuffix(parkingAreas);
  return caches.map((cache) => {
    const candidates = bySuffix.get(suffixOf(cache.code));
    if (candidates) return { ...cache, parking: nearest(cache, candidates) };
    const withoutParking = { ...cache };
    delete withoutParking.parking;
    return withoutParking;
  });
}
