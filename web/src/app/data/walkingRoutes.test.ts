import { afterEach, describe, expect, it, vi } from 'vitest';

import { tableUrl } from '../lib/routing/osrmTable';
import { makeCache } from '../lib/trails/trails.test-support';
import { pairKey } from '../lib/trails/walkingDistances';
import { fetchWalkingDistances } from './walkingRoutes';

const a = makeCache({ code: 'GCWA', latitude: 48, longitude: 11 });
const b = makeCache({ code: 'GCWB', latitude: 48.001, longitude: 11 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWalkingDistances', () => {
  it('asks the routing server for the table and reads the distances', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          code: 'Ok',
          distances: [
            [0, 150],
            [150, 0],
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;

    expect(await fetchWalkingDistances([a, b], signal)).toEqual([
      [pairKey(a, b), 150],
    ]);
    expect(fetch).toHaveBeenCalledWith(tableUrl([a, b]), { signal });
  });

  it('fails on an error status, naming it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ code: 'TooBig' }, { status: 400 })),
      ),
    );
    await expect(
      fetchWalkingDistances([a, b], new AbortController().signal),
    ).rejects.toThrow('Routing server: 400');
  });

  it('fails on an answer that is no distance table', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ code: 'NoTable' }))),
    );
    await expect(
      fetchWalkingDistances([a, b], new AbortController().signal),
    ).rejects.toThrow('Routing failed: NoTable');
  });
});
