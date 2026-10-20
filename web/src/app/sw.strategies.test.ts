import { afterEach, describe, expect, it, vi } from 'vitest';

import { installCaches, loadWorker, ORIGIN } from './sw.test-support';

const SHELL_CACHE = 'powertrailbuddy-shell-b1';
const TILE = 'https://tile.openstreetmap.org/12/2200/1343.png';
const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fetch that answers only when the test says so, as on one bar of signal. */
function hangingFetch() {
  let answer: (response: Response) => void = () => {};
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetch);
  return { fetch, answer: (response: Response) => answer(response) };
}

describe('cacheFirst', () => {
  const asset = `${ORIGIN}/PowerTrailBuddy/_next/static/chunks/1.js`;

  it.each([SHELL_CACHE, 'powertrailbuddy-shell-b0'])(
    'answers from a shell cache of this app (%s) without touching the network',
    async (cacheName) => {
      const fake = installCaches();
      await fake.storage.open('powertrailbuddy-shell-empty');
      await (
        await fake.storage.open(cacheName)
      ).put(asset, new Response('cached'));
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const { worker } = loadWorker();

      const response = await worker.cacheFirst(new Request(asset));

      expect(await response.text()).toBe('cached');
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  // Every project page of an account shares one github.io origin, and so one Cache Storage.
  it("never answers from another app's cache, or from this app's other caches", async () => {
    const fake = installCaches();
    await fake.storage.open(SHELL_CACHE);
    for (const cacheName of [
      'collectionbuddy-shell-1',
      'powertrailbuddy-tiles',
      'powertrailbuddy-shared-files',
    ]) {
      await (
        await fake.storage.open(cacheName)
      ).put(asset, new Response('planted'));
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('fresh')),
    );
    const { worker } = loadWorker();

    const response = await worker.cacheFirst(new Request(asset));

    expect(await response.text()).toBe('fresh');
  });

  it("fetches a miss and keeps it in this build's cache", async () => {
    const fake = installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('fresh')),
    );
    const { worker } = loadWorker();

    const response = await worker.cacheFirst(new Request(asset));

    expect(await response.text()).toBe('fresh');
    await vi.waitFor(() => expect(fake.urls(SHELL_CACHE)).toEqual([asset]));
  });

  it('never keeps a failed response', async () => {
    const fake = installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    );
    const { worker } = loadWorker();

    const response = await worker.cacheFirst(new Request(asset));

    expect(response.status).toBe(404);
    expect(fake.urls(SHELL_CACHE)).toEqual([]);
  });
});

describe('networkFirst', () => {
  const page = `${ORIGIN}/PowerTrailBuddy/`;

  // The build's install is the only writer of its cache: a page from the network may be the next build's.
  it('answers from the network and keeps nothing', async () => {
    const fake = installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('online')),
    );
    const { worker } = loadWorker();

    const response = await worker.networkFirst(new Request(page));

    expect(await response.text()).toBe('online');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fake.urls(SHELL_CACHE)).toEqual([]);
  });

  it('passes a failed response on', async () => {
    installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 500 })),
    );
    const { worker } = loadWorker();

    expect((await worker.networkFirst(new Request(page))).status).toBe(500);
  });

  it('opens the last shell it kept when offline', async () => {
    const fake = installCaches();
    await (
      await fake.storage.open(SHELL_CACHE)
    ).put(page, new Response('kept'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { worker } = loadWorker();

    const response = await worker.networkFirst(new Request(page));

    expect(await response.text()).toBe('kept');
  });

  it('opens the kept page for a navigation that adds a query, as after a share', async () => {
    const fake = installCaches();
    await (
      await fake.storage.open(SHELL_CACHE)
    ).put(page, new Response('kept'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { worker } = loadWorker();

    const response = await worker.networkFirst(new Request(`${page}?shared=1`));

    expect(await response.text()).toBe('kept');
  });

  it('waits about three seconds for the network before it opens the kept shell', () => {
    const { worker } = loadWorker();
    expect(worker.NETWORK_TIMEOUT_MS).toBe(3000);
  });

  it('opens the kept shell when the network does not answer in time', async () => {
    const fake = installCaches();
    await (
      await fake.storage.open(SHELL_CACHE)
    ).put(page, new Response('kept'));
    hangingFetch();
    const { worker } = loadWorker();

    const response = await worker.networkFirst(new Request(page), 5);

    expect(await response.text()).toBe('kept');
  });

  // After a deploy, on a weak signal: the next build's page arrives late, and its chunks are in no cache.
  it("still opens this build's page offline after the next build's page arrived late", async () => {
    const fake = installCaches();
    await (
      await fake.storage.open(SHELL_CACHE)
    ).put(page, new Response('build b1'));
    const network = hangingFetch();
    const { worker } = loadWorker();

    expect(await (await worker.networkFirst(new Request(page), 5)).text()).toBe(
      'build b1',
    );
    network.answer(new Response('build b2'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const offline = await worker.networkFirst(new Request(page));

    expect(await offline.text()).toBe('build b1');
    expect(fake.urls(SHELL_CACHE)).toEqual([page]);
  });

  it('answers from the network when it is quicker than the timeout', async () => {
    const fake = installCaches();
    await (
      await fake.storage.open(SHELL_CACHE)
    ).put(page, new Response('kept'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('online')),
    );
    const { worker } = loadWorker();

    const response = await worker.networkFirst(new Request(page), 60_000);

    expect(await response.text()).toBe('online');
  });

  it('gives up on an answer after the timeout, saying so', async () => {
    const { worker } = loadWorker();

    await expect(
      worker.settlesWithin(new Promise(() => {}), 5),
    ).rejects.toThrow(new Error('No answer within 5 ms'));
  });

  it('leaves no timer behind once the network has answered', async () => {
    vi.useFakeTimers();
    try {
      const { worker } = loadWorker();

      expect(await worker.settlesWithin(Promise.resolve('online'), 3000)).toBe(
        'online',
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps waiting for a slow network when nothing is kept', async () => {
    installCaches();
    const network = hangingFetch();
    const { worker } = loadWorker();

    const answered = worker.networkFirst(new Request(page), 5);
    await new Promise((resolve) => setTimeout(resolve, 20));
    network.answer(new Response('slow'));

    expect(await (await answered).text()).toBe('slow');
  });

  it('fails as the network did when offline with nothing kept', async () => {
    installCaches();
    const offline = new TypeError('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(offline));
    const { worker } = loadWorker();

    await expect(worker.networkFirst(new Request(page))).rejects.toBe(offline);
  });
});

describe('tileFirst', () => {
  const NOW = Date.UTC(2026, 0, 15);

  function tileResponse(body: string) {
    return new Response(body, { headers: { 'content-type': 'image/png' } });
  }

  async function keepTileAt(url: string, body: string, keptAt: number) {
    const { worker } = loadWorker();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => tileResponse(body)),
    );
    await worker.tileFirst(new Request(url), keptAt);
    await vi.waitFor(async () =>
      expect(await (await caches.match(url))?.text()).toBe(body),
    );
  }

  it('keeps a tile it fetched, in a cache of its own that outlives builds', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => tileResponse('fresh')),
    );

    const response = await worker.tileFirst(new Request(TILE), NOW);

    expect(await response.text()).toBe('fresh');
    expect(worker.TILE_CACHE).toBe('powertrailbuddy-tiles');
    await vi.waitFor(() =>
      expect(fake.urls(worker.TILE_CACHE)).toEqual([TILE]),
    );
    const kept = await caches.match(TILE);
    expect(kept?.headers.get('content-type')).toBe('image/png');
  });

  it('answers a kept tile without touching the network', async () => {
    installCaches();
    await keepTileAt(TILE, 'kept', NOW);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { worker } = loadWorker();

    const response = await worker.tileFirst(new Request(TILE), NOW + DAY_MS);

    expect(await response.text()).toBe('kept');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches a tile again once it is a week old, and keeps the new one', async () => {
    installCaches();
    await keepTileAt(TILE, 'old', NOW);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => tileResponse('new')),
    );
    const { worker } = loadWorker();
    expect(worker.MAX_TILE_AGE_MS).toBe(7 * DAY_MS);

    const justFresh = await worker.tileFirst(
      new Request(TILE),
      NOW + 7 * DAY_MS - 1,
    );
    expect(await justFresh.text()).toBe('old');

    const response = await worker.tileFirst(
      new Request(TILE),
      NOW + 7 * DAY_MS,
    );

    expect(await response.text()).toBe('new');
    await vi.waitFor(async () =>
      expect(await (await caches.match(TILE))?.text()).toBe('new'),
    );
  });

  it('shows a tile past its age when the network is gone', async () => {
    installCaches();
    await keepTileAt(TILE, 'old', NOW);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { worker } = loadWorker();

    const response = await worker.tileFirst(
      new Request(TILE),
      NOW + 30 * DAY_MS,
    );

    expect(await response.text()).toBe('old');
  });

  it('shows a tile past its age when the tile server refuses, and keeps no refusal', async () => {
    const fake = installCaches();
    await keepTileAt(TILE, 'old', NOW);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('busy', { status: 429 })),
    );
    const { worker } = loadWorker();

    const response = await worker.tileFirst(
      new Request(TILE),
      NOW + 30 * DAY_MS,
    );

    expect(await response.text()).toBe('old');
    expect(fake.urls(worker.TILE_CACHE)).toEqual([TILE]);
  });

  it.each([
    ['the type the tile server sent', 'image/webp', 'image/webp'],
    ['a PNG type when the server sent none', '', 'image/png'],
  ])('keeps a tile with %s', async (_, sent, kept) => {
    installCaches();
    const body = new Blob(['tile'], { type: sent });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const { worker } = loadWorker();

    await worker.tileFirst(new Request(TILE), NOW);

    await vi.waitFor(async () =>
      expect((await caches.match(TILE))?.headers.get('content-type')).toBe(
        kept,
      ),
    );
  });

  it('passes a refusal on, keeping nothing, when no tile is kept', async () => {
    const fake = installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    );
    const { worker } = loadWorker();

    const response = await worker.tileFirst(new Request(TILE), NOW);

    expect(response.status).toBe(404);
    expect(fake.urls(worker.TILE_CACHE)).toEqual([]);
  });

  it('answers an error status, not a failed fetch, offline with no tile kept', async () => {
    installCaches();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { worker } = loadWorker();

    const response = await worker.tileFirst(new Request(TILE), NOW);

    expect(response.status).toBe(504);
    expect(response.statusText).toBe('Offline');
    expect(await response.text()).toBe('');
  });

  it('keeps at most 5,000 tiles, dropping the oldest first', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();
    expect(worker.MAX_TILES).toBe(5000);
    const cache = await caches.open(worker.TILE_CACHE);
    const urls = Array.from(
      { length: 5 },
      (_, index) => `https://tile.openstreetmap.org/1/${index}/0.png`,
    );
    for (const url of urls) await cache.put(url, tileResponse(url));

    await worker.evictOldTiles(cache, 3);

    expect(fake.urls(worker.TILE_CACHE)).toEqual(urls.slice(2));
    await worker.evictOldTiles(cache, 3);
    expect(fake.urls(worker.TILE_CACHE)).toEqual(urls.slice(2));
  });

  it('drops the oldest tile when keeping one more would pass the cap', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();
    const cache = await caches.open(worker.TILE_CACHE);
    const kept = Array.from(
      { length: worker.MAX_TILES },
      (_, index) => `https://tile.openstreetmap.org/18/${index}/0.png`,
    );
    for (const url of kept) await cache.put(url, tileResponse(url));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => tileResponse('new')),
    );

    await worker.tileFirst(new Request(TILE), NOW);

    await vi.waitFor(() =>
      expect(fake.urls(worker.TILE_CACHE)).toEqual([...kept.slice(1), TILE]),
    );
  });

  it('counts a tile fetched again as new, so it is the last to go', async () => {
    const fake = installCaches();
    const first = 'https://tile.openstreetmap.org/1/0/0.png';
    const second = 'https://tile.openstreetmap.org/1/1/0.png';
    await keepTileAt(first, 'a', NOW);
    await keepTileAt(second, 'b', NOW);
    await keepTileAt(first, 'a2', NOW + 8 * DAY_MS);

    expect(fake.urls('powertrailbuddy-tiles')).toEqual([second, first]);
  });
});
