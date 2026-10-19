export type CacheType =
  | 'traditional'
  | 'multi'
  | 'mystery'
  | 'letterbox'
  | 'wherigo'
  | 'earthcache'
  | 'virtual'
  | 'webcam'
  | 'event'
  | 'other';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type RecentLogType =
  'found' | 'dnf' | 'note' | 'maintenance' | 'disabled' | 'other';

export interface RecentLog {
  type: RecentLogType;
  /** ISO date, YYYY-MM-DD. */
  date: string;
}

export interface Geocache extends Coordinates {
  /** e.g. GC1ABCD or OC1234, upper-case; the cache's identity. */
  code: string;
  name: string;
  type: CacheType;
  /** 1..5 in 0.5 steps. */
  difficulty: number;
  /** 1..5 in 0.5 steps. */
  terrain: number;
  /** As the file gives it, e.g. 'Micro', 'Small', 'Not chosen'. */
  container: string;
  /** false when temporarily disabled. */
  available: boolean;
  archived: boolean;
  /** Found by the Pocket Query's owner according to the file (`<sym>Geocache Found</sym>`). */
  found: boolean;
  /** The owner's name as the listing shows it; '' when absent. */
  placedBy: string;
  /** The decoded hint; '' when none. */
  hint: string;
  /** Newest first, at most 5. */
  recentLogs: RecentLog[];
  /** The queries that delivered it, each its GPX file's name (`sourceName`); empty for a cache stored before they were kept. */
  sources: string[];
  /** The nearest 'Parking Area' additional waypoint of this cache from the same import. */
  parking?: Coordinates;
}
