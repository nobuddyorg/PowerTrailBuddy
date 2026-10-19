import { compareCodes } from '../trails/compareCodes';
import type { Geocache } from './types';

/** What an import brings: its caches, and every query it read in full, whose earlier caches it replaces. */
export interface IncomingCaches {
  caches: readonly Geocache[];
  sources: readonly string[];
}

export interface MergedCaches {
  caches: Geocache[];
  /** Existing caches gone because every query that had them was imported again without them. */
  removedCount: number;
}

/** Every query named in any of the lists, once each, in code-unit order. */
export function sourcesOf(...lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())].sort(compareCodes);
}

/** Union by code, `incoming` winning; a query imported again drops what it no longer lists and no other query has. */
export function mergeCaches(
  existing: readonly Geocache[],
  incoming: IncomingCaches,
): MergedCaches {
  const replaced = new Set(incoming.sources);
  const notReplaced = (source: string) => !replaced.has(source);
  const byCode = new Map(existing.map((cache) => [cache.code, cache]));
  const delivered = new Set<string>();
  for (const cache of incoming.caches) {
    const earlier = byCode.get(cache.code)?.sources ?? [];
    const sources = sourcesOf(earlier.filter(notReplaced), cache.sources);
    byCode.set(cache.code, { ...cache, sources });
    delivered.add(cache.code);
  }
  const caches: Geocache[] = [];
  for (const cache of byCode.values()) {
    if (delivered.has(cache.code)) {
      caches.push(cache);
      continue;
    }
    const sources = cache.sources.filter(notReplaced);
    if (cache.sources.length === 0 || sources.length > 0) {
      caches.push({ ...cache, sources });
    }
  }
  return { caches, removedCount: byCode.size - caches.length };
}
