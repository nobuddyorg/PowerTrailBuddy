import type { Coordinates } from '../geocache/types';

/** Haversine distance on a sphere of radius 6371008.8 m. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  void a;
  void b;
  throw new Error('not implemented');
}

/** Initial bearing from a to b, in degrees 0..360. */
export function bearingDegrees(a: Coordinates, b: Coordinates): number {
  void [a, b];
  throw new Error('not implemented');
}
