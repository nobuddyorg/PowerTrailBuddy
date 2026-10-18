import type { Coordinates } from '../geocache/types';
import { distanceMeters } from './geo';

export interface WalkLimits {
  maxWalkMeters: number;
  detourFactor: number;
}

/** Greedy consecutive walks within maxWalkMeters, way back and detour included; a lone cache is always a walk. */
export function splitWalks<T extends Coordinates>(
  ordered: readonly T[],
  limits: WalkLimits,
): T[][] {
  if (ordered.length === 0) return [];
  const walks: T[][] = [[ordered[0]]];
  let walkPathMeters = 0;
  for (const point of ordered.slice(1)) {
    const walk = walks[walks.length - 1];
    const extendedPathMeters =
      walkPathMeters + distanceMeters(walk[walk.length - 1], point);
    const extendedWalkMeters =
      (extendedPathMeters + distanceMeters(point, walk[0])) *
      limits.detourFactor;
    if (extendedWalkMeters <= limits.maxWalkMeters) {
      walk.push(point);
      walkPathMeters = extendedPathMeters;
    } else {
      walks.push([point]);
      walkPathMeters = 0;
    }
  }
  return walks;
}
