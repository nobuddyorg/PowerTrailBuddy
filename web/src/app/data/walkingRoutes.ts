import type { Geocache } from '../lib/geocache/types';
import { parseTable, tableUrl } from '../lib/routing/osrmTable';

/** Every walking distance among the caches, from the routing server; rejects on any failure. */
export async function fetchWalkingDistances(
  caches: readonly Geocache[],
  signal: AbortSignal,
): Promise<[string, number][]> {
  const response = await fetch(tableUrl(caches), { signal });
  if (!response.ok) throw new Error(`Routing server: ${response.status}`);
  return parseTable(caches, await response.json());
}
