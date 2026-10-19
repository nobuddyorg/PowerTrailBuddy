import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import { distanceMeters, pathMeters } from './geo';
import { centerOf } from './projection';
import { trailShape } from './trailShape';
import type { Trail, TrailSettings } from './types';
import type { LegMeters } from './walkingDistances';

/** The smallest code and the count: stable whichever way round the trail is walked. */
function trailId(caches: readonly Geocache[]): string {
  const [smallestCode] = caches.map((cache) => cache.code).sort(compareCodes);
  return `${smallestCode}-${caches.length}`;
}

function walkingMeters(
  caches: readonly Geocache[],
  legMeters: LegMeters,
): number {
  let total = legMeters(caches[caches.length - 1], caches[0]);
  for (let index = 1; index < caches.length; index++) {
    total += legMeters(caches[index - 1], caches[index]);
  }
  return total;
}

/** Distances, time and shape of one walk, in walking order; non-empty input. */
export function scoreTrail(
  caches: readonly Geocache[],
  { settings, legMeters }: { settings: TrailSettings; legMeters: LegMeters },
): Trail {
  const walkMeters = walkingMeters(caches, legMeters);
  const durationMinutes =
    (walkMeters / 1000 / settings.walkingSpeedKmh) * 60 +
    caches.length * settings.minutesPerCache;
  return {
    id: trailId(caches),
    caches: [...caches],
    pathMeters: pathMeters(caches),
    returnMeters: distanceMeters(caches[caches.length - 1], caches[0]),
    walkMeters,
    durationMinutes,
    cachesPerHour: (caches.length / durationMinutes) * 60,
    shape: trailShape(caches),
    center: centerOf(caches),
  };
}
