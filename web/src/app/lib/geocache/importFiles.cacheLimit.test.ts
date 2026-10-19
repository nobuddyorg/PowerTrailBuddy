// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { buildGpx, fileOf, type WaypointSpec } from './gpx.test-support';
import { importFiles, MAX_IMPORT_CACHES } from './importFiles';

/** Bare waypoints with just what the parser needs, so tens of thousands parse quickly. */
function cachesFrom(first: number, count: number): WaypointSpec[] {
  return Array.from({ length: count }, (_, offset) => ({
    code: `GC0T${(first + offset).toString(36).toUpperCase()}`,
    lat: 10,
    lon: 20,
    cache: { difficulty: 1, terrain: 1 },
  }));
}

const oneShort = cachesFrom(0, MAX_IMPORT_CACHES - 1);

describe('importFiles: the number of caches', () => {
  it(`takes caches up to ${MAX_IMPORT_CACHES}, each code once, and refuses a file that would go past them`, async () => {
    const result = await importFiles([
      // One short of the limit, two of them listed twice.
      fileOf(buildGpx([...oneShort, oneShort[0], oneShort[1]]), 'all.gpx'),
      fileOf(buildGpx(cachesFrom(MAX_IMPORT_CACHES - 1, 2)), 'two-more.gpx'),
      fileOf(buildGpx(cachesFrom(MAX_IMPORT_CACHES - 1, 1)), 'one-more.gpx'),
      fileOf(buildGpx(cachesFrom(MAX_IMPORT_CACHES, 1)), 'past.gpx'),
      fileOf(buildGpx(oneShort.slice(0, 2)), 'again.gpx'),
    ]);
    expect(result.files).toEqual([
      { name: 'all.gpx', cacheCount: MAX_IMPORT_CACHES + 1 },
      { name: 'two-more.gpx', cacheCount: 0, error: 'too-large' },
      { name: 'one-more.gpx', cacheCount: 1 },
      { name: 'past.gpx', cacheCount: 0, error: 'too-large' },
      { name: 'again.gpx', cacheCount: 2 },
    ]);
    expect(result.caches).toHaveLength(MAX_IMPORT_CACHES);
    // A refused query is not counted as read, so a later merge keeps what it had imported before.
    expect(result.sources).toEqual(['again', 'all', 'one-more']);
  }, 60_000);
});
