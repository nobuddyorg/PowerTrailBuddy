import { afterEach, describe, expect, it, vi } from 'vitest';

import { SHARED_FILES_CACHE, takeSharedFiles } from './sharedFiles';

const BASE = 'https://example.test/PowerTrailBuddy';

type Stored = [url: string, body: string, type?: string];

// A Cache Storage holding one cache, enough for what takeSharedFiles touches.
function fakeCacheStorage(stored: Stored[], missing: string[] = []) {
  // A Blob body, not a string: a string body would add its own text/plain type.
  const entries = new Map(
    stored.map(([url, body, type]) => [
      url,
      new Response(new Blob([body], type ? { type } : {})),
    ]),
  );
  const cache = {
    keys: vi.fn(async () => [...entries.keys()].map((url) => new Request(url))),
    match: vi.fn(async (request: Request) =>
      missing.includes(request.url) ? undefined : entries.get(request.url),
    ),
  };
  const storage = {
    open: vi.fn(async () => cache),
    delete: vi.fn(async () => true),
  };
  vi.stubGlobal('caches', storage);
  return storage;
}

describe('takeSharedFiles', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives nothing back where the browser has no Cache Storage', async () => {
    vi.stubGlobal('caches', undefined);

    expect(await takeSharedFiles()).toEqual([]);
  });

  it('reads every shared file in the order it was shared, with its name and type', async () => {
    fakeCacheStorage([
      [`${BASE}/shared-file/1/second.gpx`, '<gpx/>', 'application/gpx+xml'],
      [
        `${BASE}/shared-file/0/My%20Query%20%231.zip`,
        'zip-bytes',
        'application/zip',
      ],
    ]);

    const files = await takeSharedFiles();

    expect(files.map((file) => [file.name, file.type])).toEqual([
      ['My Query #1.zip', 'application/zip'],
      ['second.gpx', 'application/gpx+xml'],
    ]);
    expect(await files[0].text()).toBe('zip-bytes');
    expect(await files[1].text()).toBe('<gpx/>');
  });

  it('orders by the number, not the text, past nine files', async () => {
    fakeCacheStorage([
      [`${BASE}/shared-file/10/eleventh.gpx`, ''],
      [`${BASE}/shared-file/9/tenth.gpx`, ''],
    ]);

    const files = await takeSharedFiles();

    expect(files.map((file) => file.name)).toEqual([
      'tenth.gpx',
      'eleventh.gpx',
    ]);
  });

  it('opens and then empties the cache the service worker writes to', async () => {
    const storage = fakeCacheStorage([[`${BASE}/shared-file/0/a.gpx`, '']]);

    await takeSharedFiles();

    expect(storage.open).toHaveBeenCalledWith(SHARED_FILES_CACHE);
    expect(storage.delete).toHaveBeenCalledWith(SHARED_FILES_CACHE);
    expect(SHARED_FILES_CACHE).toBe('powertrailbuddy-shared-files');
  });

  it('leaves the type empty when the service worker stored none', async () => {
    fakeCacheStorage([[`${BASE}/shared-file/0/a.gpx`, '']]);

    const [file] = await takeSharedFiles();

    expect(file.type).toBe('');
  });

  it('skips an entry that is not a shared file, and one that vanished meanwhile', async () => {
    fakeCacheStorage(
      [
        [`${BASE}/other/thing`, ''],
        [`${BASE}/shared-file/x/a.gpx`, ''],
        [`${BASE}/shared-file/2/nested.gpx/more`, ''],
        [`${BASE}/shared-file/0/gone.gpx`, ''],
        [`${BASE}/shared-file/1/kept.gpx`, ''],
      ],
      [`${BASE}/shared-file/0/gone.gpx`],
    );

    const files = await takeSharedFiles();

    expect(files.map((file) => file.name)).toEqual(['kept.gpx']);
  });
});
