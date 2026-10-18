import type { Coordinates } from '../geocache/types';
import { EARTH_RADIUS_METERS, toRadians } from './geo';

export interface PlanePoint {
  x: number;
  y: number;
}

/** b.longitude - a.longitude, wrapped into [-180, 180) so the antimeridian is no seam. */
export function longitudeOffset(from: number, to: number): number {
  const offset = (((to - from) % 360) + 360) % 360;
  return offset < 180 ? offset : offset - 360;
}

/** Mean position of a non-empty set; longitudes average as offsets from the first point, so ±180° does not cancel out. */
export function centerOf(points: readonly Coordinates[]): Coordinates {
  const reference = points[0].longitude;
  let latitudeSum = 0;
  let offsetSum = 0;
  for (const point of points) {
    latitudeSum += point.latitude;
    offsetSum += longitudeOffset(reference, point.longitude);
  }
  return {
    latitude: latitudeSum / points.length,
    longitude: longitudeOffset(0, reference + offsetSum / points.length),
  };
}

/** Equirectangular meters around a non-empty set's center: accurate for the few kilometers a trail spans. */
export function projectToPlane(points: readonly Coordinates[]): PlanePoint[] {
  const center = centerOf(points);
  const metersPerRadianEast =
    EARTH_RADIUS_METERS * Math.cos(toRadians(center.latitude));
  return points.map((point) => ({
    x:
      metersPerRadianEast *
      toRadians(longitudeOffset(center.longitude, point.longitude)),
    y: EARTH_RADIUS_METERS * toRadians(point.latitude - center.latitude),
  }));
}
