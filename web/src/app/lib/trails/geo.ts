import type { Coordinates } from '../geocache/types';

/** Mean Earth radius (IUGG). */
export const EARTH_RADIUS_METERS = 6371008.8;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Haversine distance on a sphere of radius 6371008.8 m. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const halfLatitudeDelta = (latitudeB - latitudeA) / 2;
  const halfLongitudeDelta = toRadians(b.longitude - a.longitude) / 2;
  const haversine =
    Math.sin(halfLatitudeDelta) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(halfLongitudeDelta) ** 2;
  // Rounding can push the term a hair past 1 for antipodal points, where asin would return NaN.
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

/** Initial bearing from a to b, in degrees 0..360. */
export function bearingDegrees(a: Coordinates, b: Coordinates): number {
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const east = Math.sin(longitudeDelta) * Math.cos(latitudeB);
  const north =
    Math.cos(latitudeA) * Math.sin(latitudeB) -
    Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta);
  return (toDegrees(Math.atan2(east, north)) + 360) % 360;
}

/** Straight-line length along the points in order. */
export function pathMeters(points: readonly Coordinates[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    total += distanceMeters(points[index - 1], points[index]);
  }
  return total;
}
