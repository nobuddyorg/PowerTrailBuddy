// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  buildGpx,
  buildZip,
  fileOf,
  gpxOf,
  parkingWaypoint,
  syntheticCache,
  unreadableFile,
  withDeclaredSizes,
  withDirectoryFlag,
  withReportedSize,
} from './gpx.test-support';
import {
  importFiles,
  MAX_ARCHIVE_ENTRIES,
  MAX_IMPORT_BYTES,
  type ImportedFile,
} from './importFiles';

const caches = [syntheticCache(1), syntheticCache(2), syntheticCache(3)];
const gpx = gpxOf(caches);
const additionalWaypoints = buildGpx([
  { code: 'PK0TEST1', lat: 10, lon: 20, sym: 'Parking Area' },
]);

async function reportOf(file: File): Promise<ImportedFile | undefined> {
  return (await importFiles([file])).files[0];
}

async function errorOf(file: File): Promise<string | undefined> {
  return (await reportOf(file))?.error;
}

async function zipFile(
  entries: Record<string, string | Uint8Array>,
  name = 'pocket-query.zip',
): Promise<File> {
  return fileOf(await buildZip(entries), name);
}

describe('importFiles: GPX files', () => {
  it('imports the caches of a .gpx file and reports their count', async () => {
    expect(await importFiles([fileOf(gpx, 'caches.gpx')])).toEqual({
      caches,
      files: [{ name: 'caches.gpx', cacheCount: 3 }],
    });
  });

  it('reads a file starting with a UTF-8 byte order mark', async () => {
    const file = fileOf(`﻿${gpx}`, 'caches.gpx');
    expect((await importFiles([file])).caches).toEqual(caches);
  });

  it('reports a .gpx file with only additional waypoints as zero caches, not an error', async () => {
    expect(await reportOf(fileOf(additionalWaypoints, 'wpts.gpx'))).toEqual({
      name: 'wpts.gpx',
      cacheCount: 0,
    });
  });

  it('reports a .gpx file that is not XML as unreadable', async () => {
    expect(await errorOf(fileOf('<gpx><wpt>', 'broken.gpx'))).toBe(
      'unreadable',
    );
  });

  it('reports a .gpx file that is XML but not GPX as unsupported', async () => {
    expect(await errorOf(fileOf('<html><body/></html>', 'page.gpx'))).toBe(
      'unsupported',
    );
  });

  for (const name of ['gone.gpx', 'gone.zip', 'gone']) {
    it(`reports ${name} as unreadable when the browser cannot read it`, async () => {
      expect(await reportOf(unreadableFile(name))).toEqual({
        name,
        cacheCount: 0,
        error: 'unreadable',
      });
    });
  }
});

describe('importFiles: choosing the format', () => {
  for (const name of ['CACHES.GPX', 'Caches.Gpx', 'my.caches.gpx']) {
    it(`reads ${name} as GPX`, async () => {
      expect(await reportOf(fileOf(gpx, name))).toEqual({
        name,
        cacheCount: 3,
      });
    });
  }

  for (const name of ['PQ.ZIP', 'pq.Zip']) {
    it(`reads ${name} as a zip archive`, async () => {
      const file = await zipFile({ 'a.gpx': gpx }, name);
      expect((await reportOf(file))?.cacheCount).toBe(3);
    });
  }

  it('reads a .gpx file by its extension even when it holds an archive', async () => {
    const zip = await buildZip({ 'a.gpx': gpx });
    expect(await errorOf(fileOf(zip, 'caches.gpx'))).toBe('unreadable');
  });

  it('reads a .zip file by its extension even when it holds GPX', async () => {
    expect(await errorOf(fileOf(gpx, 'caches.zip'))).toBe('unreadable');
  });

  for (const name of ['caches.kml', 'caches.gpx.txt', 'caches.xml', 'pq.7z']) {
    it(`refuses ${name} as unsupported, whatever it holds`, async () => {
      expect(await errorOf(fileOf(gpx, name))).toBe('unsupported');
    });
  }

  for (const name of ['shared', 'shared.']) {
    it(`sniffs a GPX document in a file named ${JSON.stringify(name)}`, async () => {
      expect(await reportOf(fileOf(`﻿ \n\t${gpx}`, name))).toEqual({
        name,
        cacheCount: 3,
      });
    });

    it(`sniffs a zip archive in a file named ${JSON.stringify(name)}`, async () => {
      const file = await zipFile({ 'a.gpx': gpx }, name);
      expect((await reportOf(file))?.cacheCount).toBe(3);
    });
  }

  it('sniffs a zip signature followed by garbage as an unreadable archive', async () => {
    expect(await errorOf(fileOf('PK\u0003\u0004 not really', 'shared'))).toBe(
      'unreadable',
    );
  });

  const notImportable: [string, string][] = [
    ['plain text', 'GC0TEST1 at 52.5 13.4'],
    ['an empty-archive signature', 'PK\u0005\u0006'],
    ['a partial zip signature', 'PK\u0003\u0005'],
    ['nothing', ''],
    ['markup after the first kilobyte', `${' '.repeat(1024)}${gpx}`],
  ];
  for (const [label, content] of notImportable) {
    it(`refuses a file without extension holding ${label} as unsupported`, async () => {
      expect(await errorOf(fileOf(content, 'shared'))).toBe('unsupported');
    });
  }
});

describe('importFiles: zip archives', () => {
  it('imports a Pocket Query archive with its additional-waypoints file', async () => {
    const parking = { latitude: 10.0012, longitude: 20.0005 };
    const file = await zipFile({
      '1234567.gpx': gpx,
      '1234567-wpts.gpx': buildGpx([parkingWaypoint(caches[0].code, parking)]),
    });
    expect(await importFiles([file])).toEqual({
      caches: [{ ...caches[0], parking }, caches[1], caches[2]],
      files: [{ name: 'pocket-query.zip', cacheCount: 3 }],
    });
  });

  it('reads every GPX entry, in archive order, in folders too', async () => {
    const more = [syntheticCache(4)];
    const file = await zipFile({
      'first.gpx': gpx,
      'folder/': '',
      'folder/second.GPX': gpxOf(more),
    });
    expect((await importFiles([file])).caches).toEqual([...caches, ...more]);
  });

  it('ignores entries that are not GPX, nested archives included', async () => {
    const nested = await buildZip({ 'inner.gpx': gpxOf([syntheticCache(9)]) });
    const file = await zipFile({
      'readme.txt': 'not a cache',
      'nested.zip': nested,
      'pq.gpx/notes': gpx,
      'pq.gpx\\notes': gpx,
      'caches.gpx': gpx,
    });
    expect(await importFiles([file])).toEqual({
      caches,
      files: [{ name: 'pocket-query.zip', cacheCount: 3 }],
    });
  });

  it('skips the metadata entries a Mac adds when it compresses a folder', async () => {
    const appleDouble = new Uint8Array([0x00, 0x05, 0x16, 0x07, 0x00, 0x02]);
    const file = await zipFile({
      'pq/1234567.gpx': gpx,
      '__MACOSX/pq/._1234567.gpx': appleDouble,
      '__MACOSX/pq/notes.gpx': appleDouble,
      'pq/._extra.gpx': appleDouble,
      '._top.gpx': appleDouble,
    });
    expect(await importFiles([file])).toEqual({
      caches,
      files: [{ name: 'pocket-query.zip', cacheCount: 3 }],
    });
  });

  it('reads a GPX entry whose name only contains the metadata markers', async () => {
    const more = [syntheticCache(4)];
    const file = await zipFile({
      'my__MACOSX/a._b.gpx': gpx,
      'x__MACOSX._.gpx': gpxOf(more),
    });
    expect((await importFiles([file])).caches).toEqual([...caches, ...more]);
  });

  it('reads an entry whose name climbs out of the archive like any other', async () => {
    const file = await zipFile({ '../../../etc/caches.gpx': gpx });
    expect((await importFiles([file])).caches).toEqual(caches);
  });

  it('refuses an archive without GPX entries as unsupported', async () => {
    const nested = await buildZip({ 'inner.gpx': gpx });
    const file = await zipFile({ 'readme.txt': 'hi', 'nested.zip': nested });
    expect(await errorOf(file)).toBe('unsupported');
  });

  it('does not read an entry flagged as a directory, whatever its name', async () => {
    const zip = await buildZip({ 'caches.gpx': gpx });
    const file = fileOf(withDirectoryFlag(zip, 0), 'pq.zip');
    expect(await errorOf(file)).toBe('unsupported');
  });

  it('refuses the whole archive as unreadable when one GPX entry is not XML', async () => {
    const file = await zipFile({ 'good.gpx': gpx, 'bad.gpx': '<gpx><wpt>' });
    expect(await reportOf(file)).toEqual({
      name: 'pocket-query.zip',
      cacheCount: 0,
      error: 'unreadable',
    });
  });

  it('refuses a GPX entry that is not GPX as unsupported', async () => {
    const file = await zipFile({ 'page.gpx': '<html/>' });
    expect(await errorOf(file)).toBe('unsupported');
  });

  it('refuses a truncated archive as unreadable', async () => {
    const zip = await buildZip({ 'caches.gpx': gpx });
    const file = fileOf(zip.slice(0, zip.length / 2), 'pq.zip');
    expect(await errorOf(file)).toBe('unreadable');
  });

  it('refuses an archive whose compressed data is damaged as unreadable', async () => {
    const zip = await buildZip({ 'caches.gpx': gpx.repeat(5) });
    const damaged = zip.slice();
    damaged.fill(0xff, 40, 200);
    expect(await errorOf(fileOf(damaged, 'pq.zip'))).toBe('unreadable');
  });

  it('decodes multi-byte characters split across inflated chunks', async () => {
    const name = '€ä😀'.repeat(30_000);
    const cache = syntheticCache(1, { name });
    const file = await zipFile({ 'caches.gpx': gpxOf([cache]) });
    expect((await importFiles([file])).caches).toEqual([cache]);
  });
});

describe('importFiles: limits', () => {
  function entries(count: number): Record<string, string> {
    const all: Record<string, string> = { 'caches.gpx': gpx };
    for (let index = 1; index < count; index += 1) {
      all[`note-${index}.txt`] = 'x';
    }
    return all;
  }

  it(`reads an archive of exactly ${MAX_ARCHIVE_ENTRIES} entries`, async () => {
    const file = await zipFile(entries(MAX_ARCHIVE_ENTRIES));
    expect((await reportOf(file))?.cacheCount).toBe(3);
  });

  it(`refuses an archive of ${MAX_ARCHIVE_ENTRIES + 1} entries as too-large`, async () => {
    const file = await zipFile(entries(MAX_ARCHIVE_ENTRIES + 1));
    expect(await errorOf(file)).toBe('too-large');
  });

  async function declaring(sizes: number[]): Promise<File> {
    const zip = await buildZip({ 'a.gpx': gpx, 'b.gpx': gpx });
    return fileOf(withDeclaredSizes(zip, sizes), 'pq.zip');
  }

  // At the limit the declared sizes pass, and inflating then finds the archive lying.
  it('inflates GPX entries declaring exactly the limit in total', async () => {
    const half = MAX_IMPORT_BYTES / 2;
    expect(await errorOf(await declaring([half, half]))).toBe('unreadable');
  });

  it('refuses GPX entries declaring one byte past the limit in total, before inflating', async () => {
    const half = MAX_IMPORT_BYTES / 2;
    expect(await errorOf(await declaring([half, half + 1]))).toBe('too-large');
  });

  it('leaves entries it will not read out of the declared total', async () => {
    const zip = await buildZip({ 'huge.bin': 'x', 'caches.gpx': gpx });
    const file = fileOf(
      withDeclaredSizes(zip, [MAX_IMPORT_BYTES * 2]),
      'pq.zip',
    );
    expect((await reportOf(file))?.cacheCount).toBe(3);
  });

  it('refuses an entry that inflates past its declared size as too-large', async () => {
    expect(await errorOf(await declaring([gpx.length - 1, gpx.length]))).toBe(
      'too-large',
    );
  });

  it('refuses an entry that inflates short of its declared size as unreadable', async () => {
    expect(await errorOf(await declaring([gpx.length, gpx.length + 1]))).toBe(
      'unreadable',
    );
  });

  it(`reads a file of exactly ${MAX_IMPORT_BYTES} bytes`, async () => {
    const file = withReportedSize(fileOf(gpx, 'caches.gpx'), MAX_IMPORT_BYTES);
    expect((await reportOf(file))?.cacheCount).toBe(3);
  });

  for (const name of ['caches.gpx', 'pq.zip', 'shared']) {
    it(`refuses ${name} one byte past the limit as too-large, without reading it`, async () => {
      const file = withReportedSize(unreadableFile(name), MAX_IMPORT_BYTES + 1);
      expect(await errorOf(file)).toBe('too-large');
    });
  }
});

describe('importFiles: batches', () => {
  it('returns nothing for no files', async () => {
    expect(await importFiles([])).toEqual({ caches: [], files: [] });
  });

  it('imports the good files of a batch and reports the bad one, in order', async () => {
    const more = [syntheticCache(4)];
    const result = await importFiles([
      fileOf(gpx, 'one.gpx'),
      fileOf('nonsense', 'two.zip'),
      fileOf(gpxOf(more), 'three.gpx'),
    ]);
    expect(result).toEqual({
      caches: [...caches, ...more],
      files: [
        { name: 'one.gpx', cacheCount: 3 },
        { name: 'two.zip', cacheCount: 0, error: 'unreadable' },
        { name: 'three.gpx', cacheCount: 1 },
      ],
    });
  });

  it('keeps one cache per code, the later file winning', async () => {
    const disabled = caches.map((cache) => ({ ...cache, available: false }));
    const result = await importFiles([
      fileOf(gpx, 'old.gpx'),
      fileOf(gpxOf(disabled), 'new.gpx'),
    ]);
    expect(result.caches).toEqual(disabled);
  });

  it('keeps the later of two caches with one code within a file', async () => {
    const first = syntheticCache(1);
    const second = { ...first, name: 'Renamed' };
    const file = fileOf(gpxOf([first, second]), 'caches.gpx');
    expect(await importFiles([file])).toEqual({
      caches: [second],
      files: [{ name: 'caches.gpx', cacheCount: 2 }],
    });
  });

  it('imports the same file twice without duplicates', async () => {
    const file = fileOf(gpx, 'caches.gpx');
    const result = await importFiles([file, file]);
    expect(result.caches).toEqual(caches);
  });
});

describe('importFiles: parking areas', () => {
  const [first] = caches;
  const near = { latitude: first.latitude + 0.0005, longitude: 20 };
  const far = { latitude: first.latitude + 0.005, longitude: 20 };

  it('matches a parking area from another file given in the same import', async () => {
    const result = await importFiles([
      fileOf(buildGpx([parkingWaypoint(first.code, near)]), 'wpts.gpx'),
      fileOf(gpx, 'caches.gpx'),
    ]);
    expect(result.caches[0]).toEqual({ ...first, parking: near });
  });

  it('picks the nearest parking area across files', async () => {
    const result = await importFiles([
      fileOf(buildGpx([parkingWaypoint(first.code, far)]), 'far.gpx'),
      fileOf(gpx, 'caches.gpx'),
      fileOf(buildGpx([parkingWaypoint(first.code, near)]), 'near.gpx'),
    ]);
    expect(result.caches[0]?.parking).toEqual(near);
  });

  it('keeps the parking area of an earlier file when a later one replaces its cache', async () => {
    const renamed = { ...first, name: 'Renamed' };
    const result = await importFiles([
      fileOf(gpxOf([{ ...first, parking: near }]), 'old.gpx'),
      fileOf(gpxOf([renamed]), 'new.gpx'),
    ]);
    expect(result.caches).toEqual([{ ...renamed, parking: near }]);
  });

  it('takes no parking area from a file that could not be read', async () => {
    const result = await importFiles([
      fileOf(gpx, 'caches.gpx'),
      fileOf(
        buildGpx([parkingWaypoint(first.code, near)]).replace('</gpx>', ''),
        'broken.gpx',
      ),
    ]);
    expect(result.caches).toEqual(caches);
  });
});
