import type { Geocache } from '../geocache/types';
import { compareCodes } from './compareCodes';
import type { TrailSettings } from './types';

export interface CandidateCriteria {
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
}

/** Why the filter leaves a cache out: a setting it misses, its state in the file, or a mark in the app. */
export type ExclusionReason =
  | 'type'
  | 'difficulty'
  | 'terrain'
  | 'disabled'
  | 'archived'
  | 'found'
  | 'marked';

/** Every reason that keeps `cache` out of the trails, in the order above; empty for a candidate. */
export function exclusionReasons(
  cache: Geocache,
  { settings, locallyFound }: CandidateCriteria,
): ExclusionReason[] {
  const checks: [ExclusionReason, boolean][] = [
    ['type', !settings.cacheTypes.includes(cache.type)],
    ['difficulty', cache.difficulty > settings.maxDifficulty],
    ['terrain', cache.terrain > settings.maxTerrain],
    ['disabled', !cache.available],
    ['archived', cache.archived],
    ['found', cache.found],
    ['marked', locallyFound.has(cache.code)],
  ];
  return checks.filter(([, applies]) => applies).map(([reason]) => reason);
}

/** Caches that may be part of a trail, sorted by code so the result does not depend on import order. */
export function filterCandidates(
  caches: readonly Geocache[],
  criteria: CandidateCriteria,
): Geocache[] {
  return caches
    .filter((cache) => exclusionReasons(cache, criteria).length === 0)
    .sort((a, b) => compareCodes(a.code, b.code));
}
