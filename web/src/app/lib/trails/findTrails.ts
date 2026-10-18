import type { Geocache } from '../geocache/types';
import type { Trail, TrailSettings } from './types';

/** Filter, link, order, split and score: deterministic for the same input. */
export function findTrails(
  caches: readonly Geocache[],
  settings: TrailSettings,
  locallyFound: ReadonlySet<string>,
): Trail[] {
  void caches;
  void settings;
  void locallyFound;
  throw new Error('not implemented');
}
