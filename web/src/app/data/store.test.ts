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
  saveCaches,
  saveIgnored,
  saveImportInfo,
  saveLocallyFound,
  savePreferences,
  saveSettings,
  saveWalk,
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
  parking: { latitude: 47.11, longitude: 8.21 },
  latitude: 47.1,
  longitude: 8.2,
};

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

  it('reads back what was saved, in its own store and key', async () => {
    await saveCaches([CACHE]);

    expect(await loadCaches()).toEqual([CACHE]);
    expect(stored('caches')).toEqual([CACHE]);
  });

  it('reads nothing from a value that is no list', async () => {
    storeRaw('caches', { GC0TEST: CACHE });

    expect(await loadCaches()).toEqual([]);
  });

  it('gives a cache stored by an older build an empty owner, hint and log list', async () => {
    const laterFields = new Set(['placedBy', 'hint', 'recentLogs', 'parking']);
    const older = Object.fromEntries(
      Object.entries(CACHE).filter(([key]) => !laterFields.has(key)),
    );
    storeRaw('caches', [older, 'junk', null]);

    expect(await loadCaches()).toEqual([
      { ...older, placedBy: '', hint: '', recentLogs: [] },
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

  it('reads back what was saved, stored as a list', async () => {
    await saveLocallyFound(new Set(['GC0A', 'GC0B']));

    expect(await loadLocallyFound()).toEqual(new Set(['GC0A', 'GC0B']));
    expect(stored('locally-found')).toEqual(['GC0A', 'GC0B']);
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
    await saveCaches([CACHE]);
    await saveSettings(DEFAULT_TRAIL_SETTINGS);
    await saveLocallyFound(new Set(['GC0A']));
    await saveWalk(WALK);
    await saveIgnored(new Set(['GC0B']));
    await savePreferences({ sort: 'nearest', showOtherCaches: false });
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
  });
});

describe('ignored codes', () => {
  it('reads none before any was ignored, and back what was saved as a list', async () => {
    expect(await loadIgnored()).toEqual(new Set());
    await saveIgnored(new Set(['GC0A']));

    expect(await loadIgnored()).toEqual(new Set(['GC0A']));
    expect(stored('ignored')).toEqual(['GC0A']);
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
    });
  });

  it('reads back what was saved', async () => {
    await savePreferences({ sort: 'shortest', showOtherCaches: false });

    expect(await loadPreferences()).toEqual({
      sort: 'shortest',
      showOtherCaches: false,
    });
    expect(stored('preferences')).toEqual({
      sort: 'shortest',
      showOtherCaches: false,
    });
  });

  it('defaults each value it cannot read on its own', async () => {
    storeRaw('preferences', { sort: 'random', showOtherCaches: false });
    expect(await loadPreferences()).toEqual({
      sort: 'rate',
      showOtherCaches: false,
    });

    storeRaw('preferences', { sort: 'caches', showOtherCaches: 'no' });
    expect(await loadPreferences()).toEqual({
      sort: 'caches',
      showOtherCaches: true,
    });

    storeRaw('preferences', ['caches']);
    expect(await loadPreferences()).toEqual(DEFAULT_PREFERENCES);
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
    ['saveCaches', () => saveCaches([CACHE])],
    ['saveSettings', () => saveSettings(DEFAULT_TRAIL_SETTINGS)],
    ['saveLocallyFound', () => saveLocallyFound(new Set(['GC0A']))],
    ['saveWalk', () => saveWalk(WALK)],
    ['saveWalk(undefined)', () => saveWalk(undefined)],
    ['saveIgnored', () => saveIgnored(new Set(['GC0A']))],
    ['savePreferences', () => savePreferences(DEFAULT_PREFERENCES)],
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
