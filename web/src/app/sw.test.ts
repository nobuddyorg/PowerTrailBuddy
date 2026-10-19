import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type FakeCacheStorage } from './data/cacheStorage.test-support';
import { SHARED_FILES_CACHE, takeSharedFiles } from './data/sharedFiles';
import {
  installCaches,
  loadWorker,
  ORIGIN,
  sharePost,
} from './sw.test-support';

const SHELL_CACHE = 'powertrailbuddy-shell-b1';
const PREVIOUS_CACHE = 'powertrailbuddy-shell-b0';
const MB = 1024 * 1024;

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
    expect(
      loadWorker({ scriptUrl: `${ORIGIN}/sw.js` }).worker.WORKER.basePath,
    ).toBe('');
  });
});

describe('isStaleCache', () => {
  const { worker } = loadWorker();
  const kept = [SHELL_CACHE, PREVIOUS_CACHE];

  it("deletes an older build's shell cache and keeps the ones it is told to", () => {
    expect(worker.isStaleCache('powertrailbuddy-shell-old', kept)).toBe(true);
    expect(worker.isStaleCache(SHELL_CACHE, kept)).toBe(false);
    expect(worker.isStaleCache(PREVIOUS_CACHE, kept)).toBe(false);
  });

  // The share target parks files there between the POST and the page that imports them.
  it('never deletes the shared-files cache', () => {
    expect(worker.isStaleCache(SHARED_FILES_CACHE, kept)).toBe(false);
  });

  it("never deletes another site's cache on the same origin", () => {
    expect(worker.isStaleCache('collectionbuddy-1', kept)).toBe(false);
    expect(worker.isOwnShellCache('collectionbuddy-1')).toBe(false);
    expect(worker.isOwnShellCache('x-powertrailbuddy-shell-b1')).toBe(false);
  });
});

describe('shellCachesToKeep', () => {
  const { worker } = loadWorker();

  it("keeps the build's own cache and that of the worker it replaces", () => {
    expect(
      worker.shellCachesToKeep(SHELL_CACHE, {
        scriptURL: `${ORIGIN}/PowerTrailBuddy/sw.js?build=b0`,
      }),
    ).toEqual([SHELL_CACHE, PREVIOUS_CACHE]);
  });

  it('keeps only its own cache on a first install', () => {
    expect(worker.shellCachesToKeep(SHELL_CACHE, null)).toEqual([SHELL_CACHE]);
  });
});

describe('strategyFor', () => {
  const { worker } = loadWorker();
  const site = `${ORIGIN}/PowerTrailBuddy`;
  const strategy = (url: string, method = 'GET', mode = 'cors') =>
    worker.strategyFor({ url, method, mode }, worker.WORKER);

  it('keeps map tiles, and only the tile URLs the map asks for', () => {
    expect(strategy('https://tile.openstreetmap.org/12/2200/1343.png')).toBe(
      'tile',
    );
    expect(
      strategy('https://tile.openstreetmap.org/_next/static/x.png', 'GET'),
    ).toBe('pass-through');
    expect(
      strategy('https://tile.openstreetmap.org/a', 'GET', 'navigate'),
    ).toBe('pass-through');
    expect(strategy('https://tile.openstreetmap.org/1/0/0.png', 'POST')).toBe(
      'pass-through',
    );
    expect(strategy('https://a.tile.openstreetmap.org/1/0/0.png')).toBe(
      'pass-through',
    );
    expect(strategy('https://tile.openstreetmap.org/x/1/0/0.png')).toBe(
      'pass-through',
    );
    expect(strategy('https://tile.openstreetmap.org/1/0/0.png.gz')).toBe(
      'pass-through',
    );
  });

  it('passes the routing server through, never caching it', () => {
    expect(
      strategy(
        'https://routing.openstreetmap.de/routed-foot/table/v1/foot/1,2;3,4',
      ),
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
  // Loaded per test, not per file: the limits are computed as the script runs.
  let worker: ReturnType<typeof loadWorker>['worker'];
  beforeEach(() => {
    worker = loadWorker().worker;
  });

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
    const consoleError = vi.spyOn(console, 'error');
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
    expect(await fake.storage.keys()).not.toContain(SHARED_FILES_CACHE);
    // Nothing to store is no failure to store.
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('stores nothing for a share past a limit', async () => {
    const fake = installCaches();
    const { worker } = loadWorker();

    const response = await worker.receiveShare(
      fakeSharePost([sized('huge.zip', 100 * MB + 1)]),
    );

    expect(response.status).toBe(303);
    expect(await fake.storage.keys()).not.toContain(SHARED_FILES_CACHE);
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
