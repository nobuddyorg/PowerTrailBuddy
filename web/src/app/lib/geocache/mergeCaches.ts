import type { Geocache } from './types';

/** Union by code, `incoming` winning; merging the same import twice changes nothing. */
export function mergeCaches(
  existing: readonly Geocache[],
  incoming: readonly Geocache[],
): Geocache[] {
  const byCode = new Map(existing.map((cache) => [cache.code, cache]));
  for (const cache of incoming) byCode.set(cache.code, cache);
  return [...byCode.values()];
}
