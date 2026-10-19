import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fakeCacheStorage,
  type FakeCacheStorage,
} from './data/cacheStorage.test-support';
import { SHARED_FILES_CACHE, takeSharedFiles } from './data/sharedFiles';
import { loadWorker, ORIGIN, SCRIPT_URL } from './sw.test-support';

const SHELL_CACHE = 'powertrailbuddy-shell-b1';
const MB = 1024 * 1024;

function installCaches(options: { refusePut?: boolean } = {}) {
  const fake = fakeCacheStorage({ baseUrl: SCRIPT_URL, ...options });
  vi.stubGlobal('caches', fake.storage);
  return fake;
}

function sharePost(files: File[], field = 'files') {
  const form = new FormData();
  for (const file of files) form.append(field, file);
  return new Request(`${ORIGIN}/PowerTrailBuddy/share-target/`, {
    method: 'POST',
    body: form,
  });
}

function sized(name: string, size: number): File {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// A share body as FormData hands it over, without allocating the bytes a size limit needs.
function fakeSharePost(values: (File | string)[]): Request {
  const form = { getAll: () => values };
  return { formData: () => Promise.resolve(form) } as unknown as Request;
}

async function storedShare(fake: FakeCacheStorage) {
  const files = await takeSharedFiles();
  expect(fake.urls(SHARED_FILES_CACHE)).toEqual([]);
  return Promise.all(
    files.map(async (file) => [file.name, file.type, await file.text()]),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cache naming', () => {
  const { worker } = loadWorker();

  it('names one cache per build', () => {
    expect(worker.cacheNameFor('?build=abc')).toBe('powertrailbuddy-shell-abc');
    expect(worker.CACHE_NAME).toBe(SHELL_CACHE);
  });

  it('still names a cache for a worker registered without a build', () => {
    expect(worker.cacheNameFor('')).toBe('powertrailbuddy-shell-unversioned');
  });

  it('shares the shared-files cache name with the page that empties it', () => {
    expect(worker.SHARED_FILES_CACHE).toBe(SHARED_FILES_CACHE);
  });
});

describe('basePathFor', () => {
  const { worker } = loadWorker();

  it('takes the directory the script is served from', () => {
    expect(worker.basePathFor('/PowerTrailBuddy/sw.js')).toBe(
      '/PowerTrailBuddy',
    );
    expect(worker.WORKER).toEqual({
      origin: ORIGIN,
      basePath: '/PowerTrailBuddy',
    });
  });

  it('is empty for a site served from the root', () => {
    expect(worker.basePathFor('/sw.js')).toBe('');
    expect(loadWorker(`${ORIGIN}/sw.js`).worker.WORKER.basePath).toBe('');
  });
});

describe('isStaleCache', () => {
  const { worker } = loadWorker();

  it("deletes an older build's shell cache and keeps the current one", () => {
    expect(worker.isStaleCache('powertrailbuddy-shell-old', SHELL_CACHE)).toBe(
      true,
    );
    expect(worker.isStaleCache(SHELL_CACHE, SHELL_CACHE)).toBe(false);
  });

  // The share target parks files there between the POST and the page that imports them.
  it('never deletes the shared-files cache', () => {
    expect(worker.isStaleCache(SHARED_FILES_CACHE, SHELL_CACHE)).toBe(false);
  });

  it("never deletes another site's cache on the same origin", () => {
    expect(worker.isStaleCache('collectionbuddy-1', SHELL_CACHE)).toBe(false);
  });
});

describe('strategyFor', () => {
  const { worker } = loadWorker();
  const site = `${ORIGIN}/PowerTrailBuddy`;
  const strategy = (url: string, method = 'GET', mode = 'cors') =>
    worker.strategyFor({ url, method, mode }, worker.WORKER);

  it('passes map tiles through, never caching them', () => {
    expect(strategy('https://tile.openstreetmap.org/12/2200/1343.png')).toBe(
      'pass-through',
    );
    expect(
      strategy('https://tile.openstreetmap.org/_next/static/x.png', 'GET'),
    ).toBe('pass-through');
    expect(
      strategy('https://tile.openstreetmap.org/a', 'GET', 'navigate'),
    ).toBe('pass-through');
  });

  it("receives a POST to the manifest's share target", () => {
    expect(strategy(`${site}/share-target/`, 'POST', 'navigate')).toBe('share');
  });

  it('receives a share only at its own path, under its own base path, from its own origin', () => {
    expect(strategy(`${site}/share-target`, 'POST')).toBe('pass-through');
    expect(strategy(`${ORIGIN}/share-target/`, 'POST')).toBe('pass-through');
    expect(strategy(`${site}/share-target/x`, 'POST')).toBe('pass-through');
    expect(
      strategy('https://elsewhere.test/PowerTrailBuddy/share-target/', 'POST'),
    ).toBe('pass-through');
  });

  it('leaves every other non-GET request alone', () => {
    expect(strategy(`${site}/`, 'POST', 'navigate')).toBe('pass-through');
    expect(strategy(`${site}/_next/static/chunks/1.js`, 'HEAD')).toBe(
      'pass-through',
    );
  });

  it('serves content-hashed Next.js assets cache-first', () => {
    expect(strategy(`${site}/_next/static/chunks/1.js`)).toBe('cache-first');
  });

  it('serves navigations and the files every page links network-first', () => {
    expect(strategy(`${site}/`, 'GET', 'navigate')).toBe('network-first');
    expect(strategy(`${site}/share-target/`, 'GET', 'navigate')).toBe(
      'network-first',
    );
    expect(strategy(`${site}/site.webmanifest`)).toBe('network-first');
    expect(strategy(`${site}/logo.svg`)).toBe('network-first');
    expect(strategy(`${site}/favicon.ico`, 'GET', 'no-cors')).toBe(
      'network-first',
    );
    expect(strategy(`${site}/favicon-32x32.png`)).toBe('network-first');
    expect(strategy(`${site}/apple-touch-icon.png`)).toBe('network-first');
  });

  it('passes anything else through', () => {
    expect(strategy(`${site}/icon-512.png`, 'GET', 'no-cors')).toBe(
      'pass-through',
    );
    expect(strategy(`${site}/sample/powertrail-sample.gpx`)).toBe(
      'pass-through',
    );
    expect(strategy(`${site}/share-target/`)).toBe('pass-through');
  });
});

describe('sharedFilePath', () => {
  const { worker } = loadWorker();

  it('files each share under its index and its encoded name', () => {
    expect(
      worker.sharedFilePath('/PowerTrailBuddy', 3, 'My Query #1.zip'),
    ).toBe('/PowerTrailBuddy/shared-file/3/My%20Query%20%231.zip');
  });

  it('names a file whose name a URL would resolve away', () => {
    expect(worker.sharedFilePath('', 0, '..')).toBe('/shared-file/0/shared-0');
    expect(worker.sharedFilePath('', 1, '.')).toBe('/shared-file/1/shared-1');
    expect(worker.sharedFilePath('', 2, '')).toBe('/shared-file/2/shared-2');
    expect(worker.sharedFilePath('', 3, '.gpx')).toBe('/shared-file/3/.gpx');
  });

  // data/sharedFiles.ts parses exactly this shape back, so any name must survive the trip through a URL.
  it('keeps the index and the name readable from the stored URL, whatever the name', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'grapheme' }),
        fc.nat(1000),
        (name, index) => {
          const path = worker.sharedFilePath('/PowerTrailBuddy', index, name);
          const pathname = new URL(path, ORIGIN).pathname;
          const match = /^\/PowerTrailBuddy\/shared-file\/(\d+)\/([^/]+)$/.exec(
            pathname,
          );
          expect(match?.[1]).toBe(String(index));
          const decoded = decodeURIComponent(match?.[2] ?? '');
          const expected =
            name.replace(/\./g, '') === '' ? `shared-${index}` : name;
          expect(decoded).toBe(expected);
        },
      ),
    );
  });
});

describe('sharedFilesWithinLimits', () => {
  const { worker } = loadWorker();

  it('keeps the files and drops text fields sent along', () => {
    const file = new File(['<gpx/>'], 'a.gpx');
    expect(worker.sharedFilesWithinLimits(['note', file, ''])).toEqual([file]);
  });

  it('accepts as many files as the limit allows, and refuses the whole share past it', () => {
    expect(worker.MAX_SHARED_FILES).toBe(20);
    const files = Array.from(
      { length: 21 },
      (_, index) => new File([''], `${index}.gpx`),
    );
    expect(worker.sharedFilesWithinLimits(files.slice(0, 20))).toHaveLength(20);
    expect(worker.sharedFilesWithinLimits(files)).toEqual([]);
  });

  it('accepts files up to the size limit in total, and refuses the whole share past it', () => {
    expect(worker.MAX_SHARED_BYTES).toBe(100 * MB);
    const atLimit = [sized('a.zip', 60 * MB), sized('b.zip', 40 * MB)];
    const pastLimit = [sized('a.zip', 60 * MB), sized('b.zip', 40 * MB + 1)];
    expect(worker.sharedFilesWithinLimits(atLimit)).toEqual(atLimit);
    expect(worker.sharedFilesWithinLimits(pastLimit)).toEqual([]);
  });
});

describe('receiveShare', () => {
  it('stores every shared file for the page, then sends the browser to it with a GET', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();

    const response = await worker.receiveShare(
      sharePost([
        new File(['zip-bytes'], 'My Query.zip', { type: 'application/zip' }),
        new File(['<gpx/>'], 'extra.gpx', { type: 'application/gpx+xml' }),
      ]),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${ORIGIN}/PowerTrailBuddy/?shared=1`,
    );
    expect(fake.urls(SHARED_FILES_CACHE)).toEqual([
      `${ORIGIN}/PowerTrailBuddy/shared-file/0/My%20Query.zip`,
      `${ORIGIN}/PowerTrailBuddy/shared-file/1/extra.gpx`,
    ]);
    expect(await storedShare(fake)).toEqual([
      ['My Query.zip', 'application/zip', 'zip-bytes'],
      ['extra.gpx', 'application/gpx+xml', '<gpx/>'],
    ]);
  });

  it('reads the files from the field the manifest names', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();

    expect(worker.SHARE_FILES_FIELD).toBe('files');
    await worker.receiveShare(
      sharePost([new File(['x'], 'other.gpx')], 'attachments'),
    );

    expect(fake.urls(SHARED_FILES_CACHE)).toEqual([]);
  });

  it('replaces an earlier share the page never took', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();

    await worker.receiveShare(
      sharePost([new File(['1'], 'first.gpx'), new File(['2'], 'second.gpx')]),
    );
    await worker.receiveShare(sharePost([new File(['3'], 'third.gpx')]));

    // multipart/form-data sends a file without a type as application/octet-stream.
    expect(await storedShare(fake)).toEqual([
      ['third.gpx', 'application/octet-stream', '3'],
    ]);
  });

  it('stores nothing, and drops an earlier share, for a body it cannot read', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();
    await worker.receiveShare(sharePost([new File(['1'], 'first.gpx')]));

    const response = await worker.receiveShare(
      new Request(`${ORIGIN}/PowerTrailBuddy/share-target/`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not a form',
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${ORIGIN}/PowerTrailBuddy/?shared=1`,
    );
    expect(fake.urls(SHARED_FILES_CACHE)).toEqual([]);
  });

  it('stores nothing for a share past a limit', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();

    const response = await worker.receiveShare(
      fakeSharePost([sized('huge.zip', 100 * MB + 1)]),
    );

    expect(response.status).toBe(303);
    expect(fake.urls(SHARED_FILES_CACHE)).toEqual([]);
  });

  it('stores none of the files when storing one fails, and says why', async () => {
    const fake = installCaches({ refusePut: true });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { worker } = loadWorker();

    const response = await worker.receiveShare(
      sharePost([new File(['1'], 'a.gpx')]),
    );

    expect(response.status).toBe(303);
    expect(fake.urls(SHARED_FILES_CACHE)).toEqual([]);
    expect(await fake.storage.keys()).not.toContain(SHARED_FILES_CACHE);
    expect(consoleError).toHaveBeenCalledWith(
      'Storing the shared files failed:',
      expect.any(DOMException),
    );
  });
});

describe('cacheFirst', () => {
  const asset = `${ORIGIN}/PowerTrailBuddy/_next/static/chunks/1.js`;

  it('answers from any cache without touching the network', async () => {
    const fake = installCaches();
    await (
      await fake.storage.open(SHELL_CACHE)
    ).put(asset, new Response('cached'));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { worker } = loadWorker();

    const response = await worker.cacheFirst(new Request(asset));

    expect(await response.text()).toBe('cached');
    expect(fetch).not.toHaveBeenCalled();
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

  it("answers from the network and keeps the shell in this build's cache", async () => {
    const fake = installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('online')),
    );
    const { worker } = loadWorker();

    const response = await worker.networkFirst(new Request(page));

    expect(await response.text()).toBe('online');
    await vi.waitFor(() => expect(fake.urls(SHELL_CACHE)).toEqual([page]));
  });

  it('never keeps a failed response', async () => {
    const fake = installCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 500 })),
    );
    const { worker } = loadWorker();

    expect((await worker.networkFirst(new Request(page))).status).toBe(500);
    expect(fake.urls(SHELL_CACHE)).toEqual([]);
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

  it('fails as the network did when offline with nothing kept', async () => {
    installCaches();
    const offline = new TypeError('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(offline));
    const { worker } = loadWorker();

    await expect(worker.networkFirst(new Request(page))).rejects.toBe(offline);
  });
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

  async function install() {
    const { self, listeners } = loadWorker();
    let work: Promise<unknown> = Promise.resolve();
    listeners.get('install')?.({
      waitUntil: (promise) => {
        work = promise;
      },
      respondWith: vi.fn(),
    });
    return { self, work };
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

  it("deletes only older builds' shell caches on activate, then claims open pages", async () => {
    const fake = installCaches();
    for (const name of [
      'powertrailbuddy-shell-old',
      SHELL_CACHE,
      SHARED_FILES_CACHE,
      'collectionbuddy-1',
    ]) {
      await fake.storage.open(name);
    }
    const { self, listeners } = loadWorker();
    let work: Promise<unknown> = Promise.resolve();

    listeners.get('activate')?.({
      waitUntil: (promise) => {
        work = promise;
      },
      respondWith: vi.fn(),
    });
    await work;

    expect(await fake.storage.keys()).toEqual([
      SHELL_CACHE,
      SHARED_FILES_CACHE,
      'collectionbuddy-1',
    ]);
    expect(self.clients.claim).toHaveBeenCalledOnce();
  });

  it('lets a map tile go to the network untouched', () => {
    const { listeners } = loadWorker();
    const respondWith = vi.fn();

    listeners.get('fetch')?.({
      request: new Request('https://tile.openstreetmap.org/1/0/0.png'),
      respondWith,
      waitUntil: vi.fn(),
    });

    expect(respondWith).not.toHaveBeenCalled();
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
