import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import { distanceMeters, pathMeters } from './geo';
import { centerOf } from './projection';
import { trailShape } from './trailShape';
import type { Trail, TrailSettings } from './types';

/** The smallest code and the count: stable whichever way round the trail is walked. */
function trailId(caches: readonly Geocache[]): string {
  const [smallestCode] = caches.map((cache) => cache.code).sort(compareCodes);
  return `${smallestCode}-${caches.length}`;
}

/** Distances, time and shape of one walk, in walking order; non-empty input. */
export function scoreTrail(
  caches: readonly Geocache[],
  settings: TrailSettings,
): Trail {
  const alongMeters = pathMeters(caches);
  const returnMeters = distanceMeters(caches[caches.length - 1], caches[0]);
  const walkMeters = (alongMeters + returnMeters) * settings.detourFactor;
  const durationMinutes =
    (walkMeters / 1000 / settings.walkingSpeedKmh) * 60 +
    caches.length * settings.minutesPerCache;
  return {
    id: trailId(caches),
    caches: [...caches],
    pathMeters: alongMeters,
    returnMeters,
    walkMeters,
    durationMinutes,
    cachesPerHour: (caches.length / durationMinutes) * 60,
    shape: trailShape(caches),
    center: centerOf(caches),
  };
}
