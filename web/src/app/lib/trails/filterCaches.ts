import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import type { TrailSettings } from './types';

export interface CandidateCriteria {
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
}

function isCandidate(
  cache: Geocache,
  { settings, locallyFound }: CandidateCriteria,
): boolean {
  return (
    settings.cacheTypes.includes(cache.type) &&
    cache.difficulty <= settings.maxDifficulty &&
    cache.terrain <= settings.maxTerrain &&
    cache.available &&
    !cache.archived &&
    !cache.found &&
    !locallyFound.has(cache.code)
  );
}

/** Caches that may be part of a trail, sorted by code so the result does not depend on import order. */
export function filterCandidates(
  caches: readonly Geocache[],
  criteria: CandidateCriteria,
): Geocache[] {
  return caches
    .filter((cache) => isCandidate(cache, criteria))
    .sort((a, b) => compareCodes(a.code, b.code));
}
