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
}
