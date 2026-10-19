import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Geocache } from '../lib/geocache/types';
import {
  DEFAULT_TRAIL_SETTINGS,
  type TrailSettings,
} from '../lib/trails/types';
import type { WalkState } from '../lib/walk/walk';
import {
  clearAllData,
  DEFAULT_PREFERENCES,
  loadCaches,
  loadIgnored,
  loadImportInfo,
  loadLocallyFound,
  loadPreferences,
  loadSettings,
  loadWalk,
  loadWalkingDistances,
  mergeIntoStoredCaches,
  saveImportInfo,
  savePreferences,
  saveSettings,
  saveWalk,
  saveWalkingDistances,
  updateIgnored,
  updateLocallyFound,
} from './store';

// IndexedDB as idb-keyval presents it: databases of key/value stores, values structured-cloned in and out.
const idb = vi.hoisted(() => ({
  stores: new Map<string, Map<string, unknown>>(),
  refuseWrites: false,
}));

vi.mock('idb-keyval', () => {
  const storeOf = (store: unknown) => {
    const name = String(store);
    const existing = idb.stores.get(name);
    if (existing) return existing;
    const created = new Map<string, unknown>();
    idb.stores.set(name, created);
    return created;
  };
  const write = (work: () => void) => {
    if (idb.refuseWrites) {
      return Promise.reject(new DOMException('full', 'QuotaExceededError'));
    }
    work();
    return Promise.resolve();
  };
  return {
    createStore: (database: string, store: string) => `${database}/${store}`,
    get: (key: string, store: unknown) =>
      Promise.resolve(structuredClone(storeOf(store).get(key))),
    set: (key: string, value: unknown, store: unknown) =>
      write(() => storeOf(store).set(key, structuredClone(value))),
    del: (key: string, store: unknown) =>
      write(() => storeOf(store).delete(key)),
    delMany: (keys: string[], store: unknown) =>
      write(() => {
        for (const key of keys) storeOf(store).delete(key);
      }),
    // Read and written in one step, as idb-keyval does in one transaction.
    update: (key: string, updater: (old: unknown) => unknown, store: unknown) =>
      write(() => {
        const old = structuredClone(storeOf(store).get(key));
        storeOf(store).set(key, structuredClone(updater(old)));
      }),
  };
});

const APP_STORE = 'powertrailbuddy/state';

function stored(key: string): unknown {
  return idb.stores.get(APP_STORE)?.get(key);
}

function storeRaw(key: string, value: unknown) {
  const store = idb.stores.get(APP_STORE) ?? new Map<string, unknown>();
  idb.stores.set(APP_STORE, store);
  store.set(key, value);
}

const CACHE: Geocache = {
  code: 'GC0TEST',
  name: 'Invented bench',
  type: 'traditional',
  difficulty: 1.5,
  terrain: 2,
  container: 'Micro',
  available: true,
  archived: false,
  found: false,
  placedBy: 'Nobody Real',
  hint: 'Under the stone',
  recentLogs: [{ type: 'found', date: '2026-05-01' }],
  sources: ['26071826'],
  parking: { latitude: 47.11, longitude: 8.21 },
  latitude: 47.1,
  longitude: 8.2,
};

const IMPORT = { caches: [CACHE], sources: CACHE.sources };

const WALK: WalkState = {
  trailId: 'GC0TEST-12',
  codes: ['GC0TEST', 'GC0TEST2', 'GC0TEST3'],
  startedAt: '2026-05-01T08:00:00.000Z',
  outcomes: {
    GC0TEST: { outcome: 'found', at: '2026-05-01T08:10:00.000Z' },
    GC0TEST2: { outcome: 'dnf', at: '2026-05-01T08:20:00.000Z' },
    GC0TEST3: { outcome: 'skipped', at: '2026-05-01T08:25:00.000Z' },
  },
  history: ['GC0TEST', 'GC0TEST2', 'GC0TEST3'],
};

beforeEach(() => {
  idb.stores.clear();
  idb.refuseWrites = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('caches', () => {
  it('reads nothing before anything was imported', async () => {
    expect(await loadCaches()).toEqual([]);
  });

  it('reads back what was imported, in its own store and key', async () => {
    expect(await mergeIntoStoredCaches(IMPORT)).toEqual({
      caches: [CACHE],
      removedCount: 0,
    });

    expect(await loadCaches()).toEqual([CACHE]);
    expect(stored('caches')).toEqual([CACHE]);
  });

  it('merges an import into what is stored, and says how many it replaced', async () => {
    const gone = { ...CACHE, code: 'GC0GONE' };
    const other = { ...CACHE, code: 'GC0OTHER', sources: ['other'] };
    storeRaw('caches', [gone, other]);

    expect(await mergeIntoStoredCaches(IMPORT)).toEqual({
      caches: [other, CACHE],
      removedCount: 1,
    });
    expect(stored('caches')).toEqual([other, CACHE]);
  });

  it('merges into stored caches of an older build as it reads them', async () => {
    const { placedBy, hint, recentLogs, sources, ...older } = CACHE;
    void [placedBy, hint, recentLogs, sources];
    const olderCode = { ...older, code: 'GC0OLD' };
    storeRaw('caches', [olderCode, 'junk']);

    const { caches } = await mergeIntoStoredCaches(IMPORT);
    expect(caches).toEqual([
      {
        ...olderCode,
        placedBy: '',
        hint: '',
        recentLogs: [],
        sources: [],
      },
      CACHE,
    ]);
  });

  // Two open windows, each holding the caches it loaded: neither import may overwrite the other.
  it('keeps the imports of two windows made one after the other', async () => {
    const second = { ...CACHE, code: 'GC0SECOND', sources: ['second'] };
    await Promise.all([
      mergeIntoStoredCaches(IMPORT),
      mergeIntoStoredCaches({ caches: [second], sources: ['second'] }),
    ]);

    expect(await loadCaches()).toEqual([CACHE, second]);
  });

  it('reads nothing from a value that is no list', async () => {
    storeRaw('caches', { GC0TEST: CACHE });

    expect(await loadCaches()).toEqual([]);
  });

  it('gives a cache stored by an older build an empty owner, hint, log and source list', async () => {
    const laterFields = new Set([
      'placedBy',
      'hint',
      'recentLogs',
      'parking',
      'sources',
    ]);
    const older = Object.fromEntries(
      Object.entries(CACHE).filter(([key]) => !laterFields.has(key)),
    );
    storeRaw('caches', [older, 'junk', null]);

    expect(await loadCaches()).toEqual([
      { ...older, placedBy: '', hint: '', recentLogs: [], sources: [] },
    ]);
  });

  it('reads sources in the wrong shape as none', async () => {
    storeRaw('caches', [
      { ...CACHE, sources: '26071826' },
      { ...CACHE, code: 'GC0TES2', sources: ['26071826', 7] },
    ]);

    expect(await loadCaches()).toEqual([
      { ...CACHE, sources: [] },
      { ...CACHE, code: 'GC0TES2', sources: [] },
    ]);
  });
});

describe('settings', () => {
  it('reads the defaults before anything was saved', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_TRAIL_SETTINGS);
  });

  it('reads back what was saved', async () => {
    const settings: TrailSettings = {
      ...DEFAULT_TRAIL_SETTINGS,
      cacheTypes: ['traditional', 'multi'],
      maxGapMeters: 500,
    };
    await saveSettings(settings);

    expect(await loadSettings()).toEqual(settings);
    expect(stored('settings')).toEqual(settings);
  });

  it('fills in what an older stored shape lacks, and clamps what is out of range', async () => {
    storeRaw('settings', { maxGapMeters: 100_000, minCaches: 5 });

    expect(await loadSettings()).toEqual({
      ...DEFAULT_TRAIL_SETTINGS,
      maxGapMeters: 2000,
      minCaches: 5,
    });
  });
});

describe('locally found codes', () => {
  it('reads none before anything was marked', async () => {
    expect(await loadLocallyFound()).toEqual(new Set());
  });

  it('reads back what was marked, stored as a list', async () => {
    await updateLocallyFound((codes) => codes.add('GC0A').add('GC0B'));

    expect(await loadLocallyFound()).toEqual(new Set(['GC0A', 'GC0B']));
    expect(stored('locally-found')).toEqual(['GC0A', 'GC0B']);
  });

  // Another open window may have marked caches since this one loaded.
  it('changes the stored codes, keeping what another window marked', async () => {
    storeRaw('locally-found', ['GC0OTHER', 'GC0A']);

    await updateLocallyFound((codes) => {
      codes.delete('GC0A');
      return codes.add('GC0B');
    });

    expect(stored('locally-found')).toEqual(['GC0OTHER', 'GC0B']);
  });

  it('changes only the codes of a value in an unexpected shape', async () => {
    storeRaw('locally-found', ['GC0A', 7]);
    await updateLocallyFound((codes) => codes.add('GC0B'));
    expect(stored('locally-found')).toEqual(['GC0A', 'GC0B']);

    storeRaw('locally-found', 'GC0A');
    await updateLocallyFound((codes) => codes.add('GC0B'));
    expect(stored('locally-found')).toEqual(['GC0B']);
  });

  it('keeps only the codes from a value in an unexpected shape', async () => {
    storeRaw('locally-found', ['GC0A', 7, null, 'GC0B']);
    expect(await loadLocallyFound()).toEqual(new Set(['GC0A', 'GC0B']));

    storeRaw('locally-found', 'GC0A');
    expect(await loadLocallyFound()).toEqual(new Set());
  });
});

describe('walk', () => {
  it('reads none before a walk started', async () => {
    expect(await loadWalk()).toBeUndefined();
  });

  it('reads back the walk in progress', async () => {
    await saveWalk(WALK);

    expect(await loadWalk()).toEqual(WALK);
    expect(stored('walk')).toEqual(WALK);
  });

  it('removes the walk once it ends', async () => {
    await saveWalk(WALK);
    await saveWalk(undefined);

    expect(await loadWalk()).toBeUndefined();
    expect(idb.stores.get(APP_STORE)?.has('walk')).toBe(false);
  });

  it('reads an empty walk with no outcomes yet', async () => {
    const fresh: WalkState = {
      trailId: 'T',
      codes: [],
      startedAt: '2026-05-01T08:00:00Z',
      outcomes: {},
      history: [],
    };
    storeRaw('walk', fresh);

    expect(await loadWalk()).toEqual(fresh);
  });

  it.each([
    ['no object', 'GC0TEST-12'],
    ['a list', [WALK]],
    ['null', null],
    ['no trail id', { ...WALK, trailId: 12 }],
    ['codes that are no list', { ...WALK, codes: 'GC0TEST' }],
    ['a code that is no string', { ...WALK, codes: ['GC0TEST', 2] }],
    ['outcomes that are no object', { ...WALK, outcomes: ['found'] }],
    ['outcomes that are null', { ...WALK, outcomes: null }],
    [
      'an unknown outcome',
      { ...WALK, outcomes: { GC0TEST: { outcome: 'lost', at: 'x' } } },
    ],
    [
      'an outcome of an older build',
      { ...WALK, outcomes: { GC0TEST: 'found' } },
    ],
    [
      'an outcome without a time',
      { ...WALK, outcomes: { GC0TEST: { outcome: 'found' } } },
    ],
    ['no start time', { ...WALK, startedAt: undefined }],
    ['no history', { ...WALK, history: undefined }],
    ['a history that is no list of codes', { ...WALK, history: [1] }],
  ])('drops a stored walk with %s', async (_shape, value) => {
    storeRaw('walk', value);

    expect(await loadWalk()).toBeUndefined();
  });
});

describe('clearAllData', () => {
  it('removes everything this app stored, and nothing else', async () => {
    await mergeIntoStoredCaches(IMPORT);
    await saveSettings(DEFAULT_TRAIL_SETTINGS);
    await updateLocallyFound((codes) => codes.add('GC0A'));
    await saveWalk(WALK);
    await updateIgnored((codes) => codes.add('GC0B'));
    await savePreferences({
      sort: 'nearest',
      showOtherCaches: false,
      walkingRoutes: true,
    });
    await saveWalkingDistances(new Map([['a|b', 120]]));
    await saveImportInfo({
      at: '2026-05-01T08:00:00Z',
      cacheCount: 1,
      fileNames: ['a.zip'],
    });
    storeRaw('unrelated', 'kept');

    await clearAllData();

    expect([...(idb.stores.get(APP_STORE)?.keys() ?? [])]).toEqual([
      'unrelated',
    ]);
    expect(await loadCaches()).toEqual([]);
    expect(await loadSettings()).toEqual(DEFAULT_TRAIL_SETTINGS);
    expect(await loadLocallyFound()).toEqual(new Set());
    expect(await loadWalk()).toBeUndefined();
    expect(await loadIgnored()).toEqual(new Set());
    expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(await loadImportInfo()).toBeUndefined();
    expect(await loadWalkingDistances()).toEqual(new Map());
  });
});

describe('ignored codes', () => {
  it('reads none before any was ignored, and back what was ignored as a list', async () => {
    expect(await loadIgnored()).toEqual(new Set());
    await updateIgnored((codes) => codes.add('GC0A'));

    expect(await loadIgnored()).toEqual(new Set(['GC0A']));
    expect(stored('ignored')).toEqual(['GC0A']);
  });

  it('changes the stored codes, keeping what another window ignored', async () => {
    storeRaw('ignored', ['GC0OTHER', 'GC0A', 5]);

    await updateIgnored((codes) => {
      codes.delete('GC0A');
      return codes;
    });

    expect(stored('ignored')).toEqual(['GC0OTHER']);
  });

  it('keeps only the codes from a value in an unexpected shape', async () => {
    storeRaw('ignored', [3, 'GC0A']);
    expect(await loadIgnored()).toEqual(new Set(['GC0A']));
  });
});

describe('preferences', () => {
  it('reads the defaults before any were saved: best rate first, other caches shown', async () => {
    expect(await loadPreferences()).toEqual({
      sort: 'rate',
      showOtherCaches: true,
      walkingRoutes: false,
    });
  });

  it('reads back what was saved', async () => {
    const saved = {
      sort: 'shortest',
      showOtherCaches: false,
      walkingRoutes: true,
    } as const;
    await savePreferences(saved);

    expect(await loadPreferences()).toEqual(saved);
    expect(stored('preferences')).toEqual(saved);
  });

  it('defaults each value it cannot read on its own', async () => {
    storeRaw('preferences', {
      sort: 'random',
      showOtherCaches: false,
      walkingRoutes: true,
    });
    expect(await loadPreferences()).toEqual({
      sort: 'rate',
      showOtherCaches: false,
      walkingRoutes: true,
    });

    storeRaw('preferences', {
      sort: 'caches',
      showOtherCaches: 'no',
      walkingRoutes: 'yes',
    });
    expect(await loadPreferences()).toEqual({
      sort: 'caches',
      showOtherCaches: true,
      walkingRoutes: false,
    });

    storeRaw('preferences', ['caches']);
    expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('walking distances', () => {
  it('reads none before any were saved, and back what was saved, unroutable pairs included', async () => {
    expect(await loadWalkingDistances()).toEqual(new Map());
    const distances = new Map([
      ['a|b', 120],
      ['a|c', Infinity],
    ]);
    await saveWalkingDistances(distances);

    expect(await loadWalkingDistances()).toEqual(distances);
    expect(stored('walking-distances')).toEqual(distances);
  });

  it('keeps only readable entries from a value in an unexpected shape', async () => {
    storeRaw(
      'walking-distances',
      new Map<unknown, unknown>([
        ['a|b', 0],
        ['a|c', -1],
        ['a|d', '12'],
        [7, 12],
        ['a|e', Infinity],
      ]),
    );
    expect(await loadWalkingDistances()).toEqual(
      new Map([
        ['a|b', 0],
        ['a|e', Infinity],
      ]),
    );
    storeRaw('walking-distances', [['a|b', 1]]);
    expect(await loadWalkingDistances()).toEqual(new Map());
  });
});

describe('the last import', () => {
  const INFO = {
    at: '2026-05-01T08:00:00Z',
    cacheCount: 812,
    fileNames: ['pq.zip', 'extra.gpx'],
  };

  it('reads none before an import, and back what was saved', async () => {
    expect(await loadImportInfo()).toBeUndefined();
    await saveImportInfo(INFO);

    expect(await loadImportInfo()).toEqual(INFO);
    expect(stored('last-import')).toEqual(INFO);
  });

  it('reads a count it cannot read as none', async () => {
    storeRaw('last-import', { ...INFO, cacheCount: 'many' });
    expect(await loadImportInfo()).toEqual({ ...INFO, cacheCount: 0 });
  });

  it.each([
    ['no object', 'pq.zip'],
    ['no time', { ...INFO, at: 5 }],
    ['file names that are no list of text', { ...INFO, fileNames: 'pq.zip' }],
  ])('drops a record with %s', async (_shape, value) => {
    storeRaw('last-import', value);
    expect(await loadImportInfo()).toBeUndefined();
  });
});

describe('when storage refuses a write', () => {
  it.each([
    ['mergeIntoStoredCaches', () => mergeIntoStoredCaches(IMPORT)],
    ['saveSettings', () => saveSettings(DEFAULT_TRAIL_SETTINGS)],
    ['updateLocallyFound', () => updateLocallyFound((codes) => codes)],
    ['saveWalk', () => saveWalk(WALK)],
    ['saveWalk(undefined)', () => saveWalk(undefined)],
    ['updateIgnored', () => updateIgnored((codes) => codes)],
    ['savePreferences', () => savePreferences(DEFAULT_PREFERENCES)],
    ['saveWalkingDistances', () => saveWalkingDistances(new Map())],
    [
      'saveImportInfo',
      () => saveImportInfo({ at: 'x', cacheCount: 0, fileNames: [] }),
    ],
    ['clearAllData', () => clearAllData()],
  ])('%s fails rather than pretending it saved', async (_name, write) => {
    idb.refuseWrites = true;

    await expect(write()).rejects.toThrow('full');
  });
});
