import type { Geocache } from './types';

/** Union by code, `incoming` winning; merging the same import twice changes nothing. */
export function mergeCaches(
  existing: readonly Geocache[],
  incoming: readonly Geocache[],
): Geocache[] {
  void existing;
  void incoming;
  throw new Error('not implemented');
}
