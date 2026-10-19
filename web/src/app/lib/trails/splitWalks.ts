import type { Coordinates } from '../geocache/types';

export interface WalkLimits<T> {
  maxWalkMeters: number;
  /** Walking meters from one point to the next. */
  legMeters: (from: T, to: T) => number;
}

/** Greedy consecutive walks within maxWalkMeters, way back included; a lone cache is always a walk. */
export function splitWalks<T extends Coordinates>(
  ordered: readonly T[],
  { maxWalkMeters, legMeters }: WalkLimits<T>,
): T[][] {
  if (ordered.length === 0) return [];
  const walks: T[][] = [[ordered[0]]];
  let walkAlongMeters = 0;
  for (const point of ordered.slice(1)) {
    const walk = walks[walks.length - 1];
    const extendedAlongMeters =
      walkAlongMeters + legMeters(walk[walk.length - 1], point);
    if (extendedAlongMeters + legMeters(point, walk[0]) <= maxWalkMeters) {
      walk.push(point);
      walkAlongMeters = extendedAlongMeters;
    } else {
      walks.push([point]);
      walkAlongMeters = 0;
    }
  }
  return walks;
}
