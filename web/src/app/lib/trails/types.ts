import type { CacheType, Coordinates, Geocache } from '../geocache/types';

export interface TrailSettings {
  cacheTypes: CacheType[];
  maxDifficulty: number;
  maxTerrain: number;
  /** Caches closer than this are linked into one group. */
  maxGapMeters: number;
  /** Smaller groups are not trails. */
  minCaches: number;
  /** Longer chains are split into several walks. */
  maxWalkKilometers: number;
  /** Only round trips: each walk reordered to end near its start, and kept only within maxReturnMeters. */
  loopsOnly: boolean;
  /** Walking meters from a round trip's last cache back to its first. */
  maxReturnMeters: number;
  walkingSpeedKmh: number;
  minutesPerCache: number;
  /** Straight line to real path, for every leg without a routed distance. */
  detourFactor: number;
}

export const DEFAULT_TRAIL_SETTINGS: TrailSettings = {
  cacheTypes: ['traditional'],
  maxDifficulty: 2,
  maxTerrain: 2,
  maxGapMeters: 300,
  minCaches: 10,
  maxWalkKilometers: 10,
  loopsOnly: false,
  maxReturnMeters: 500,
  walkingSpeedKmh: 4,
  minutesPerCache: 3,
  detourFactor: 1.3,
};

export interface Trail {
  /** Stable: derived from the codes it contains, never random. */
  id: string;
  /** In walking order. */
  caches: Geocache[];
  /** Straight line along the order. */
  pathMeters: number;
  /** Straight line from the last cache back to the first. */
  returnMeters: number;
  /** Along the order and back: each leg routed where known, else straight times detourFactor. */
  walkMeters: number;
  /** walkMeters at walkingSpeedKmh, plus minutesPerCache for each cache. */
  durationMinutes: number;
  cachesPerHour: number;
  /** From the eigenvalue ratio of the projected coordinates: 'line' when elongated. */
  shape: 'line' | 'area';
  center: Coordinates;
}
