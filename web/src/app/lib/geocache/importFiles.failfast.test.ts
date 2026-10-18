// Node environment on purpose: without a DOMParser, parsing fails in a way no file can cause.
import { describe, expect, it } from 'vitest';

import { buildZip, fileOf, gpxOf, syntheticCache } from './gpx.test-support';
import { importFiles } from './importFiles';

const gpx = gpxOf([syntheticCache(1)]);

describe('importFiles: failures that are not the file’s fault', () => {
  it('rejects instead of reporting a GPX file as broken', async () => {
    await expect(importFiles([fileOf(gpx, 'caches.gpx')])).rejects.toThrow(
      ReferenceError,
    );
  });

  it('rejects instead of reporting an archive as broken', async () => {
    const file = fileOf(await buildZip({ 'caches.gpx': gpx }), 'pq.zip');
    await expect(importFiles([file])).rejects.toThrow(ReferenceError);
  });
});
