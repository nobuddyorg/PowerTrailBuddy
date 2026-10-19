import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import { filterCandidates } from './filterCaches';
import { linkComponents } from './linkComponents';
import { orderPath } from './orderPath';
import { scoreTrail } from './scoreTrail';
import { splitWalks } from './splitWalks';
import type { Trail, TrailSettings } from './types';

function compareTrails(a: Trail, b: Trail): number {
  if (a.cachesPerHour > b.cachesPerHour) return -1;
  if (a.cachesPerHour < b.cachesPerHour) return 1;
  return b.caches.length - a.caches.length || compareCodes(a.id, b.id);
}

/** Filter, link, order, split and score: deterministic for the same input. */
export function findTrails(
  caches: readonly Geocache[],
  settings: TrailSettings,
  locallyFound: ReadonlySet<string>,
): Trail[] {
  const candidates = filterCandidates(caches, { settings, locallyFound });
  const limits = {
    maxWalkMeters: settings.maxWalkKilometers * 1000,
    detourFactor: settings.detourFactor,
  };
  return (
    linkComponents(candidates, settings.maxGapMeters)
      .flatMap((component) => splitWalks(orderPath(component), limits))
      // A group below minCaches only splits into walks below it, so this one check drops both.
      .filter((walk) => walk.length >= settings.minCaches)
      .map((walk) => scoreTrail(walk, settings))
      .sort(compareTrails)
  );
}
