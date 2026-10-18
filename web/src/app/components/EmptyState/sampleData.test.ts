// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { importFiles } from '../../lib/geocache/importFiles';
import { findTrails } from '../../lib/trails/findTrails';
import { DEFAULT_TRAIL_SETTINGS } from '../../lib/trails/types';
import { withPreset } from '../../lib/ui-logic/presets';

// The files "Try with sample data" loads; useAppState fetches them from public/sample/.
const SAMPLE_FILES = ['powertrail-sample.gpx', 'powertrail-sample-wpts.gpx'];

async function importSample() {
  const files = SAMPLE_FILES.map((name) => {
    const text = readFileSync(join(__dirname, '../../../../public/sample', name), 'utf8');
    return new File([text], name, { type: 'application/gpx+xml' });
  });
  return importFiles(files);
}

describe('the sample Pocket Query', () => {
  it('holds only invented codes, which real geocaching.com codes can never be', async () => {
    const { caches } = await importSample();
    expect(caches).toHaveLength(76);
    expect(caches.every((cache) => /^GCSU/.test(cache.code))).toBe(true);
  });

  it('shows three power trails with the default settings, each with parking at its start', async () => {
    const { caches } = await importSample();
    const trails = findTrails(caches, DEFAULT_TRAIL_SETTINGS, new Set());
    expect(trails.map((trail) => trail.caches.length).sort((a, b) => a - b)).toEqual([13, 16, 22]);
    expect(trails.every((trail) => trail.caches.some((cache) => cache.parking))).toBe(true);
  });

  it('has doubtful caches to show the health warnings', async () => {
    const { caches } = await importSample();
    const byCode = new Map(caches.map((cache) => [cache.code, cache]));
    expect(byCode.get('GCSUA08')?.recentLogs.slice(0, 2).map((log) => log.type)).toEqual(['dnf', 'dnf']);
    expect(byCode.get('GCSUA16')?.recentLogs[0].type).toBe('maintenance');
    expect(byCode.get('GCSUB17')?.available).toBe(false);
  });

  it('drops the widely spaced line under the classic preset', async () => {
    const { caches } = await importSample();
    const classic = withPreset(DEFAULT_TRAIL_SETTINGS, 'classic');
    expect(findTrails(caches, classic, new Set()).map((trail) => trail.caches.length)).toEqual([22]);
  });
});
