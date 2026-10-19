import type { Geocache } from './types';

export type CacheHealth =
  'ok' | 'disabled' | 'dnf-streak' | 'needs-maintenance';

/** A warning sign from the file: disabled, the two newest logs both DNFs, or the newest asking for maintenance. */
export function cacheHealth(cache: Geocache): CacheHealth {
  if (!cache.available) return 'disabled';
  const [newest, previous] = cache.recentLogs;
  if (newest?.type === 'dnf' && previous?.type === 'dnf') return 'dnf-streak';
  if (newest?.type === 'maintenance') return 'needs-maintenance';
  return 'ok';
}
