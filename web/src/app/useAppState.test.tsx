// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fileOf, gpxOf } from './lib/geocache/gpx.test-support';
import type { Geocache } from './lib/geocache/types';
import { makeCaches, makeTrail } from './lib/ui-logic/ui.test-support';
import { DEFAULT_TRAIL_SETTINGS } from './lib/trails/types';
import { memoryIdb, storedValue, storeValue } from './memoryIdb.test-support';
import { useAppState } from './useAppState';

vi.mock('idb-keyval', () => import('./memoryIdb.test-support'));

const shared = vi.hoisted(() => ({ take: vi.fn<() => Promise<File[]>>() }));
vi.mock('./data/sharedFiles', () => ({ takeSharedFiles: shared.take }));

const importer = vi.hoisted(() => ({ fail: false }));
vi.mock('./lib/geocache/importFiles', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('./lib/geocache/importFiles')>();
  return {
    ...real,
    importFiles: (files: readonly File[]) =>
      importer.fail
        ? Promise.reject(new Error('boom'))
        : real.importFiles(files),
  };
});

const CACHES = makeCaches(3, 'GCAPP');
const pqFile = (caches: readonly Geocache[], name = 'pq.gpx') =>
  fileOf(gpxOf(caches), name);

async function renderReady() {
  const view = renderHook(() => useAppState());
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

beforeEach(() => {
  memoryIdb.reset();
  importer.fail = false;
  shared.take.mockReset().mockResolvedValue([]);
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loading', () => {
  it('starts empty with the defaults when nothing was stored', async () => {
    const { result } = await renderReady();
    expect(result.current.caches).toEqual([]);
    expect(result.current.settings).toEqual(DEFAULT_TRAIL_SETTINGS);
    expect(result.current.walk).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(shared.take).not.toHaveBeenCalled();
  });

  it('reads back what an earlier session stored', async () => {
    storeValue('caches', CACHES);
    storeValue('locally-found', ['GCAPP1']);
    storeValue('ignored', ['GCAPP2']);
    const { result } = await renderReady();
    expect(result.current.caches.map((cache) => cache.code)).toEqual([
      'GCAPP1',
      'GCAPP2',
      'GCAPP3',
    ]);
    expect([...result.current.locallyFound]).toEqual(['GCAPP1']);
    expect([...result.current.ignored]).toEqual(['GCAPP2']);
  });

  it('reports storage it cannot read and still shows the app', async () => {
    memoryIdb.refuseReads = true;
    const { result } = await renderReady();
    expect(result.current.error).toBe('load-failed');
    expect(result.current.caches).toEqual([]);
  });

  it('stops quietly when unmounted before the stored data arrives', async () => {
    const { unmount, result } = renderHook(() => useAppState());
    unmount();
    await act(() => Promise.resolve());
    expect(result.current.ready).toBe(false);
  });

  it('reports nothing when unmounted before a failed read', async () => {
    memoryIdb.refuseReads = true;
    const { unmount, result } = renderHook(() => useAppState());
    unmount();
    await act(() => Promise.resolve());
    expect(result.current.error).toBeUndefined();
  });
});

describe('importing', () => {
  it('merges an import into the caches, stores it and sums it up', async () => {
    const { result } = await renderReady();
    await act(() => result.current.importFiles([pqFile(CACHES)]));
    expect(result.current.caches).toHaveLength(3);
    expect(result.current.lastImport).toEqual({
      cacheCount: 3,
      files: [{ name: 'pq.gpx', cacheCount: 3 }],
    });
    expect(result.current.importInfo).toMatchObject({
      cacheCount: 3,
      fileNames: ['pq.gpx'],
    });
    expect(storedValue('caches')).toHaveLength(3);
    expect(storedValue('last-import')).toEqual(result.current.importInfo);
    act(() => result.current.dismissImport());
    expect(result.current.lastImport).toBeUndefined();
  });

  it('keeps what was there when another Pocket Query comes in', async () => {
    const { result } = await renderReady();
    await act(() => result.current.importFiles([pqFile(CACHES)]));
    await act(() =>
      result.current.importFiles([pqFile(makeCaches(2, 'GCMORE'), 'b.gpx')]),
    );
    expect(result.current.caches).toHaveLength(5);
    expect(result.current.lastImport?.cacheCount).toBe(2);
  });

  it('does nothing for an empty selection', async () => {
    const { result } = await renderReady();
    await act(() => result.current.importFiles([]));
    expect(result.current.lastImport).toBeUndefined();
    expect(result.current.importing).toBe(false);
  });

  it('reports an import that fails as a whole', async () => {
    importer.fail = true;
    const { result } = await renderReady();
    await act(() => result.current.importFiles([pqFile(CACHES)]));
    expect(result.current.error).toBe('import-failed');
    expect(result.current.importing).toBe(false);
    act(() => result.current.dismissError());
    expect(result.current.error).toBeUndefined();
  });

  it('reports a save the browser refuses', async () => {
    const { result } = await renderReady();
    memoryIdb.refuseWrites = true;
    await act(() => result.current.importFiles([pqFile(CACHES)]));
    await waitFor(() => expect(result.current.error).toBe('save-failed'));
    expect(result.current.caches).toHaveLength(3);
  });

  // Any website can post a form to the share target, so a share is imported only once the user agrees.
  it('takes the files shared to the app and asks first, tidying the address', async () => {
    shared.take.mockResolvedValue([pqFile(CACHES, 'shared.gpx')]);
    window.history.replaceState(null, '', '/?shared=1');
    const { result } = await renderReady();
    await waitFor(() =>
      expect(result.current.pendingShare.map((file) => file.name)).toEqual([
        'shared.gpx',
      ]),
    );
    expect(window.location.search).toBe('');
    expect(result.current.caches).toEqual([]);
    expect(storedValue('caches')).toBeUndefined();
  });

  it('imports the shared files once the user agrees', async () => {
    shared.take.mockResolvedValue([pqFile(CACHES, 'shared.gpx')]);
    window.history.replaceState(null, '', '/?shared=1');
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.pendingShare).toHaveLength(1));
    await act(() => result.current.acceptShare());
    expect(result.current.caches).toHaveLength(3);
    expect(result.current.lastImport?.files[0].name).toBe('shared.gpx');
    expect(result.current.pendingShare).toEqual([]);
  });

  it('drops the shared files, importing nothing, when the user declines', async () => {
    shared.take.mockResolvedValue([pqFile(CACHES, 'shared.gpx')]);
    window.history.replaceState(null, '', '/?shared=1');
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.pendingShare).toHaveLength(1));
    act(() => result.current.declineShare());
    expect(result.current.pendingShare).toEqual([]);
    expect(result.current.caches).toEqual([]);
    expect(result.current.lastImport).toBeUndefined();
  });

  it('says so when the share delivered no file', async () => {
    window.history.replaceState(null, '', '/?shared=1');
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.error).toBe('share-empty'));
    expect(window.location.search).toBe('');
    expect(result.current.caches).toEqual([]);
  });

  it('reports shared files it cannot take', async () => {
    shared.take.mockRejectedValue(new Error('no cache storage'));
    window.history.replaceState(null, '', '/?shared=1');
    const { result } = await renderReady();
    await waitFor(() => expect(result.current.error).toBe('import-failed'));
  });
});

describe('the sample', () => {
  it('fetches both sample files and imports them', async () => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      const text = gpxOf(url.endsWith('-wpts.gpx') ? [] : CACHES);
      // A Blob of this realm: jsdom's File cannot read one made by Node's Response.
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([text])),
      });
    });
    const { result } = await renderReady();
    await act(() => result.current.importSample());
    expect(fetched).toEqual([
      '/sample/powertrail-sample.gpx',
      '/sample/powertrail-sample-wpts.gpx',
    ]);
    expect(result.current.caches).toHaveLength(3);
  });

  it('reports a sample it cannot fetch', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('', { status: 404 })),
    );
    const { result } = await renderReady();
    await act(() => result.current.importSample());
    expect(result.current.error).toBe('sample-failed');
    expect(result.current.caches).toEqual([]);
  });
});

describe('settings, preferences and clearing', () => {
  it('applies and stores new settings', async () => {
    const { result } = await renderReady();
    const settings = { ...DEFAULT_TRAIL_SETTINGS, minCaches: 4 };
    act(() => result.current.applySettings(settings));
    expect(result.current.settings).toEqual(settings);
    await waitFor(() => expect(storedValue('settings')).toEqual(settings));
  });

  it('changes one preference and keeps the others', async () => {
    const { result } = await renderReady();
    act(() => result.current.setPreferences({ sort: 'shortest' }));
    act(() => result.current.setPreferences({ showOtherCaches: false }));
    act(() => result.current.setPreferences({ walkingRoutes: true }));
    expect(result.current.preferences).toEqual({
      sort: 'shortest',
      showOtherCaches: false,
      walkingRoutes: true,
    });
    expect(storedValue('preferences')).toEqual(result.current.preferences);
  });

  it('forgets everything on clear', async () => {
    storeValue('caches', CACHES);
    const { result } = await renderReady();
    await act(() => result.current.importFiles([pqFile(CACHES)]));
    await act(() => result.current.clearData());
    expect(result.current.caches).toEqual([]);
    expect(result.current.lastImport).toBeUndefined();
    expect(storedValue('caches')).toBeUndefined();
  });

  it('reports a clear the browser refuses and keeps the data', async () => {
    storeValue('caches', CACHES);
    const { result } = await renderReady();
    memoryIdb.refuseWrites = true;
    await act(() => result.current.clearData());
    expect(result.current.error).toBe('save-failed');
    expect(result.current.caches).toHaveLength(3);
  });
});

describe('marks', () => {
  it('marks a cache found and takes it back', async () => {
    const { result } = await renderReady();
    act(() => result.current.markFound('GCAPP1'));
    act(() => result.current.markFound('GCAPP2'));
    expect([...result.current.locallyFound]).toEqual(['GCAPP1', 'GCAPP2']);
    act(() => result.current.unmarkFound('GCAPP1'));
    expect(storedValue('locally-found')).toEqual(['GCAPP2']);
    act(() => result.current.resetLocallyFound());
    expect(result.current.locallyFound.size).toBe(0);
  });

  it('ignores a cache and takes it back', async () => {
    const { result } = await renderReady();
    act(() => result.current.ignore('GCAPP3'));
    expect(storedValue('ignored')).toEqual(['GCAPP3']);
    act(() => result.current.unignore('GCAPP3'));
    expect(result.current.ignored.size).toBe(0);
  });
});

describe('walking', () => {
  const TRAIL = makeTrail({ id: 'walk-trail', caches: CACHES });
  const codes = (walk: { codes: string[] } | undefined) => walk?.codes;

  it('starts a walk in trail order, reversed, or from a chosen end', async () => {
    const { result } = await renderReady();
    act(() => result.current.startWalk(TRAIL));
    expect(codes(result.current.walk)).toEqual(['GCAPP1', 'GCAPP2', 'GCAPP3']);
    expect(result.current.walk?.trailId).toBe('walk-trail');
    act(() => result.current.startWalk(TRAIL, { reversed: true }));
    expect(codes(result.current.walk)).toEqual(['GCAPP3', 'GCAPP2', 'GCAPP1']);
    act(() => result.current.startWalk(TRAIL, { fromCode: 'GCAPP3' }));
    expect(codes(result.current.walk)?.[0]).toBe('GCAPP3');
    expect(storedValue('walk')).toEqual(result.current.walk);
  });

  it('records outcomes, and a find also marks the cache found', async () => {
    const { result } = await renderReady();
    act(() => result.current.startWalk(TRAIL));
    act(() => result.current.recordOutcome('GCAPP1', 'found'));
    act(() => result.current.recordOutcome('GCAPP2', 'dnf'));
    const outcomes = result.current.walk?.outcomes ?? {};
    expect(outcomes.GCAPP1.outcome).toBe('found');
    expect(outcomes.GCAPP2.outcome).toBe('dnf');
    expect([...result.current.locallyFound]).toEqual(['GCAPP1']);
  });

  it('undoes a find, unmarking it, and a DNF, leaving the marks alone', async () => {
    const { result } = await renderReady();
    act(() => result.current.markFound('GCOTHER'));
    act(() => result.current.startWalk(TRAIL));
    act(() => result.current.recordOutcome('GCAPP1', 'found'));
    act(() => result.current.recordOutcome('GCAPP2', 'dnf'));
    act(() => result.current.undoOutcome());
    expect(result.current.walk?.outcomes.GCAPP2).toBeUndefined();
    expect([...result.current.locallyFound]).toEqual(['GCOTHER', 'GCAPP1']);
    act(() => result.current.undoOutcome());
    expect(result.current.walk?.history).toEqual([]);
    expect([...result.current.locallyFound]).toEqual(['GCOTHER']);
  });

  it('turns the walk around and ends it', async () => {
    const { result } = await renderReady();
    act(() => result.current.startWalk(TRAIL));
    act(() => result.current.reverseWalk());
    expect(codes(result.current.walk)).toEqual(['GCAPP3', 'GCAPP2', 'GCAPP1']);
    act(() => result.current.endWalk());
    expect(result.current.walk).toBeUndefined();
    await waitFor(() => expect(storedValue('walk')).toBeUndefined());
  });

  it('ignores walk actions while no walk is on, and an undo with nothing to undo', async () => {
    const { result } = await renderReady();
    act(() => result.current.recordOutcome('GCAPP1', 'found'));
    act(() => result.current.undoOutcome());
    act(() => result.current.reverseWalk());
    expect(result.current.walk).toBeUndefined();
    expect(result.current.locallyFound.size).toBe(0);
    act(() => result.current.startWalk(TRAIL));
    const started = result.current.walk;
    act(() => result.current.undoOutcome());
    expect(result.current.walk).toBe(started);
  });
});
