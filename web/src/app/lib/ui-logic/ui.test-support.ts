import type { Geocache } from '../geocache/types';
import type { Trail } from '../trails/types';

/** A synthetic cache: invented code, name and position. */
export function makeCache(overrides: Partial<Geocache> = {}): Geocache {
  return {
    code: 'GCSU001',
    name: 'Invented Bench',
    type: 'traditional',
    difficulty: 1.5,
    terrain: 2,
    container: 'Micro',
    available: true,
    archived: false,
    found: false,
    placedBy: 'Nobody Real',
    hint: '',
    recentLogs: [],
    sources: [],
    latitude: 47.5,
    longitude: 9.5,
    ...overrides,
  };
}

/** `count` synthetic caches in a row heading east, about 150 m apart. */
export function makeCaches(count: number, prefix = 'GCSU'): Geocache[] {
  return Array.from({ length: count }, (_, index) =>
    makeCache({
      code: `${prefix}${index + 1}`,
      name: `Row stop ${index + 1}`,
      longitude: 9.5 + index * 0.002,
    }),
  );
}

export function makeTrail(overrides: Partial<Trail> = {}): Trail {
  const caches = overrides.caches ?? makeCaches(12);
  return {
    id: `${caches[0].code}-${caches.length}`,
    caches,
    pathMeters: 1650,
    returnMeters: 1650,
    walkMeters: 4290,
    durationMinutes: 100,
    cachesPerHour: 7.2,
    shape: 'line',
    center: { latitude: 47.5, longitude: 9.511 },
    ...overrides,
  };
}
