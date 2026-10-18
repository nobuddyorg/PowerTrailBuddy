import type { Geocache } from '../geocache/types';

const DEFAULT_LIMIT = 8;

// Lower is better: the exact code, a code prefix, a name word starting with the query, the query anywhere in the name.
function score(cache: Geocache, query: string): number {
  const code = cache.code.toLowerCase();
  const name = cache.name.toLowerCase();
  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  return Infinity;
}

/** The caches whose code or name matches the typed text, best matches first, at most `limit`. */
export function searchCaches(
  caches: readonly Geocache[],
  { query, limit = DEFAULT_LIMIT }: { query: string; limit?: number },
): Geocache[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [];
  return caches
    .map((cache) => ({ cache, score: score(cache, normalized) }))
    .filter((entry) => entry.score !== Infinity)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.cache.name.localeCompare(b.cache.name) ||
        a.cache.code.localeCompare(b.cache.code),
    )
    .slice(0, limit)
    .map((entry) => entry.cache);
}
