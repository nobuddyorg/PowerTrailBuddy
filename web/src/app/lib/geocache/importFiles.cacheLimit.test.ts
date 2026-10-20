// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { buildGpx, fileOf, type WaypointSpec } from './gpx.test-support';
import { importFiles, MAX_IMPORT_CACHES } from './importFiles';

/** Bare waypoints with just what the parser needs. */
function cachesFrom(first: number, count: number): WaypointSpec[] {
  return Array.from({ length: count }, (_, offset) => ({
    code: `GC0T${(first + offset).toString(36).toUpperCase()}`,
    lat: 10,
    lon: 20,
    cache: { difficulty: 1, terrain: 1 },
  }));
}

// A small limit exercises the same count as the real one without parsing tens of thousands of waypoints.
const LIMIT = 6;
const oneShort = cachesFrom(0, LIMIT - 1);

describe('importFiles: the number of caches', () => {
  it('holds at most twenty full Pocket Queries by default', () => {
    expect(MAX_IMPORT_CACHES).toBe(20_000);
  });

  it('takes caches up to its limit, each code once, and refuses a file that would go past them', async () => {
    const result = await importFiles(
      [
        // One short of the limit, two of them listed twice.
        fileOf(buildGpx([...oneShort, oneShort[0], oneShort[1]]), 'all.gpx'),
        fileOf(buildGpx(cachesFrom(LIMIT - 1, 2)), 'two-more.gpx'),
        fileOf(buildGpx(cachesFrom(LIMIT - 1, 1)), 'one-more.gpx'),
        fileOf(buildGpx(cachesFrom(LIMIT, 1)), 'past.gpx'),
        fileOf(buildGpx(oneShort.slice(0, 2)), 'again.gpx'),
      ],
      { maxCaches: LIMIT },
    );
    expect(result.files).toEqual([
      { name: 'all.gpx', cacheCount: LIMIT + 1 },
      { name: 'two-more.gpx', cacheCount: 0, error: 'too-large' },
      { name: 'one-more.gpx', cacheCount: 1 },
      { name: 'past.gpx', cacheCount: 0, error: 'too-large' },
      { name: 'again.gpx', cacheCount: 2 },
    ]);
    expect(result.caches).toHaveLength(LIMIT);
    // A refused query is not counted as read, so a later merge keeps what it had imported before.
    expect(result.sources).toEqual(['again', 'all', 'one-more']);
  });
});
