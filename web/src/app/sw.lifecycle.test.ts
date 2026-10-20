import { afterEach, describe, expect, it, vi } from 'vitest';

import { type FakeCacheStorage } from './data/cacheStorage.test-support';
import { SHARED_FILES_CACHE } from './data/sharedFiles';
import {
  installCaches,
  loadWorker,
  ORIGIN,
  sharePost,
} from './sw.test-support';

const SHELL_CACHE = 'powertrailbuddy-shell-b1';
const PREVIOUS_CACHE = 'powertrailbuddy-shell-b0';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lifecycle events', () => {
  const base = `${ORIGIN}/PowerTrailBuddy`;
  const SHELL = [
    `${base}/`,
    `${base}/site.webmanifest`,
    `${base}/logo.svg`,
    `${base}/favicon.ico`,
    `${base}/favicon-32x32.png`,
    `${base}/apple-touch-icon.png`,
  ];
  const ASSETS = ['/_next/static/chunks/app.js', '/_next/static/media/a.png'];

  // The host: the precache manifest, then every file it and the shell name, unless `missing` says otherwise.
  function serveBuild(missing: string[] = []) {
    const fetched: Request[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        fetched.push(request);
        if (missing.includes(request.url))
          return new Response('', { status: 404 });
        if (request.url === `${base}/precache-manifest.json`)
          return Response.json(ASSETS);
        return new Response(request.url);
      }),
    );
    return fetched;
  }

  async function install(replacing?: string) {
    const { worker, self, listeners } = loadWorker({ replacing });
    let work: Promise<unknown> = Promise.resolve();
    listeners.get('install')?.({
      waitUntil: (promise) => {
        work = promise;
      },
      respondWith: vi.fn(),
    });
    return { worker, self, work };
  }

  it('keeps the page, the shell and every asset of its build before taking over', async () => {
    const fake = installCaches();
    const fetched = serveBuild();

    const { self, work } = await install();
    await work;

    expect(fake.urls(SHELL_CACHE)).toEqual([
      ...SHELL,
      ...ASSETS.map((asset) => `${base}${asset}`),
    ]);
    expect(await (await caches.match(`${base}/`))?.text()).toBe(`${base}/`);
    // A page or list from the HTTP cache could name an older build's assets.
    expect(fetched.map((request) => request.cache)).toEqual(
      fetched.map(() => 'no-cache'),
    );
    expect(self.skipWaiting).toHaveBeenCalledOnce();
  });

  it('does not install without the list of assets to keep', async () => {
    const fake = installCaches();
    serveBuild([`${base}/precache-manifest.json`]);

    const { self, work } = await install();

    await expect(work).rejects.toThrow('Precache manifest: HTTP 404');
    expect(fake.urls(SHELL_CACHE)).toEqual([]);
    expect(self.skipWaiting).not.toHaveBeenCalled();
  });

  it('does not install, keeping nothing, when one file of the shell is missing', async () => {
    const fake = installCaches();
    serveBuild([`${base}/_next/static/chunks/app.js`]);

    const { self, work } = await install();

    await expect(work).rejects.toThrow();
    expect(fake.urls(SHELL_CACHE)).toEqual([]);
    expect(self.skipWaiting).not.toHaveBeenCalled();
  });

  async function openCaches(fake: FakeCacheStorage, names: string[]) {
    for (const name of names) await fake.storage.open(name);
  }

  const OTHERS = [
    'powertrailbuddy-shell-old',
    PREVIOUS_CACHE,
    SHARED_FILES_CACHE,
    'powertrailbuddy-tiles',
    'collectionbuddy-1',
  ];

  it("keeps the replaced build's cache for its open pages, and deletes only older builds' shell caches", async () => {
    const fake = installCaches();
    await openCaches(fake, OTHERS);
    serveBuild();

    const { work } = await install(`${base}/sw.js?build=b0`);
    await work;

    expect(await fake.storage.keys()).toEqual([
      PREVIOUS_CACHE,
      SHARED_FILES_CACHE,
      'powertrailbuddy-tiles',
      'collectionbuddy-1',
      SHELL_CACHE,
    ]);
  });

  it('still serves an open page of the replaced build the chunks it has yet to load', async () => {
    const fake = installCaches();
    const lazyChunk = `${base}/_next/static/chunks/map-b0.js`;
    await (
      await fake.storage.open(PREVIOUS_CACHE)
    ).put(lazyChunk, new Response('b0 map'));
    const fetched = serveBuild();

    const { worker, work } = await install(`${base}/sw.js?build=b0`);
    await work;
    const response = await worker.cacheFirst(new Request(lazyChunk));

    expect(await response.text()).toBe('b0 map');
    expect(fetched.map((request) => request.url)).not.toContain(lazyChunk);
  });

  it('deletes every other shell cache on a first install', async () => {
    const fake = installCaches();
    await openCaches(fake, OTHERS);
    serveBuild();

    const { work } = await install();
    await work;

    expect(await fake.storage.keys()).toEqual([
      SHARED_FILES_CACHE,
      'powertrailbuddy-tiles',
      'collectionbuddy-1',
      SHELL_CACHE,
    ]);
  });

  it('deletes nothing when the install fails', async () => {
    const fake = installCaches();
    await openCaches(fake, OTHERS);
    serveBuild([`${base}/precache-manifest.json`]);

    const { work } = await install();

    await expect(work).rejects.toThrow();
    expect(await fake.storage.keys()).toEqual(OTHERS);
  });

  it('claims open pages on activate, deleting nothing', async () => {
    const fake = installCaches();
    await openCaches(fake, OTHERS);
    const { self, listeners } = loadWorker();
    let work: Promise<unknown> = Promise.resolve();

    listeners.get('activate')?.({
      waitUntil: (promise) => {
        work = promise;
      },
      respondWith: vi.fn(),
    });
    await work;

    expect(await fake.storage.keys()).toEqual(OTHERS);
    expect(self.clients.claim).toHaveBeenCalledOnce();
  });

  it('lets a request to the routing server go to the network untouched', () => {
    const { listeners } = loadWorker();
    const respondWith = vi.fn();

    listeners.get('fetch')?.({
      request: new Request(
        'https://routing.openstreetmap.de/routed-foot/table/v1/foot/1,2;3,4',
      ),
      respondWith,
      waitUntil: vi.fn(),
    });

    expect(respondWith).not.toHaveBeenCalled();
  });

  it('answers a map tile itself', async () => {
    installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('tile')),
    );
    const { listeners } = loadWorker();
    let answer: Promise<Response> | undefined;

    listeners.get('fetch')?.({
      request: new Request('https://tile.openstreetmap.org/1/0/0.png'),
      respondWith: (response) => {
        answer = response;
      },
      waitUntil: vi.fn(),
    });

    expect(await (await answer)?.text()).toBe('tile');
  });

  it('answers a share target POST with the stored share', async () => {
    const fake = installCaches();
    const { listeners } = loadWorker();
    let answer: Promise<Response> | undefined;

    listeners.get('fetch')?.({
      request: sharePost([new File(['<gpx/>'], 'a.gpx')]),
      respondWith: (response) => {
        answer = response;
      },
      waitUntil: vi.fn(),
    });

    expect((await answer)?.status).toBe(303);
    expect(fake.urls(SHARED_FILES_CACHE)).toHaveLength(1);
  });
});
