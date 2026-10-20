import { createStore, del, delMany, get, set, update } from 'idb-keyval';

import {
  mergeCaches,
  type IncomingCaches,
  type MergedCaches,
} from '../lib/geocache/mergeCaches';
import type { Geocache } from '../lib/geocache/types';
import type { TrailSettings } from '../lib/trails/types';
import type { WalkingDistances } from '../lib/trails/walkingDistances';
import { TRAIL_SORTS, type TrailSort } from '../lib/ui-logic/trailSort';
import type { WalkState } from '../lib/walk/walk';
import { sanitizeSettings } from './sanitizeSettings';

// The only module that imports idb-keyval (dependency-cruiser's storage-behind-data-layer); keys: docs/reference/architecture.md.

// createStore opens nothing until the first call, so importing this during the static prerender is safe.
const store = createStore('powertrailbuddy', 'state');

const KEYS = {
  caches: 'caches',
  settings: 'settings',
  locallyFound: 'locally-found',
  walk: 'walk',
  ignored: 'ignored',
  preferences: 'preferences',
  lastImport: 'last-import',
  walkingDistances: 'walking-distances',
} as const;

export interface UiPreferences {
  sort: TrailSort;
  /** Imported caches that belong to no trail, drawn dimmed on the map. */
  showOtherCaches: boolean;
  /** Opted in to sending trail caches' coordinates to the routing server for walking distances. */
  walkingRoutes: boolean;
}

export const DEFAULT_PREFERENCES: UiPreferences = {
  sort: 'rate',
  showOtherCaches: true,
  walkingRoutes: false,
};

export interface ImportInfo {
  /** ISO date-time of the last import. */
  at: string;
  cacheCount: number;
  fileNames: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const OUTCOMES: readonly unknown[] = ['found', 'dnf', 'skipped'];

const isRecordedOutcome = (value: unknown): boolean =>
  isRecord(value) && OUTCOMES.includes(value.outcome) && isString(value.at);

// A walk in an unreadable shape, an older build's included, is dropped rather than resumed half-broken.
function isWalkState(value: unknown): value is WalkState {
  return (
    isRecord(value) &&
    isString(value.trailId) &&
    isStringArray(value.codes) &&
    isString(value.startedAt) &&
    isRecord(value.outcomes) &&
    Object.values(value.outcomes).every(isRecordedOutcome) &&
    isStringArray(value.history)
  );
}

function codesOf(stored: unknown): Set<string> {
  return new Set(Array.isArray(stored) ? stored.filter(isString) : []);
}

async function loadCodes(key: string): Promise<Set<string>> {
  return codesOf(await get(key, store));
}

// Read, changed and written in one transaction, so another open window's marks in between are kept.
function updateCodes(
  key: string,
  change: (codes: Set<string>) => ReadonlySet<string>,
): Promise<void> {
  return update(key, (stored: unknown) => [...change(codesOf(stored))], store);
}

// Caches stored before owner, hint, logs and sources were read get them empty, so the UI never meets a missing field.
function withLaterFields(cache: Record<string, unknown>): Geocache {
  return {
    placedBy: '',
    hint: '',
    recentLogs: [],
    ...cache,
    // No sources: a later import of any query keeps the cache rather than guessing which query it came from.
    sources: isStringArray(cache.sources) ? cache.sources : [],
  } as unknown as Geocache;
}

function cachesOf(stored: unknown): Geocache[] {
  return Array.isArray(stored)
    ? stored.filter(isRecord).map(withLaterFields)
    : [];
}

export async function loadCaches(): Promise<Geocache[]> {
  return cachesOf(await get(KEYS.caches, store));
}

/** Merges an import into the stored caches in one transaction, so an import from another open window is kept too. */
export async function mergeIntoStoredCaches(
  incoming: IncomingCaches,
): Promise<MergedCaches> {
  // Set by the updater, which idb-keyval runs before the write it resolves on.
  let merged!: MergedCaches;
  await update(
    KEYS.caches,
    (stored: unknown) => {
      merged = mergeCaches(cachesOf(stored), incoming);
      return merged.caches;
    },
    store,
  );
  return merged;
}

/** Stored settings with the defaults filled in for anything missing, and anything out of range clamped. */
export async function loadSettings(): Promise<TrailSettings> {
  return sanitizeSettings(await get(KEYS.settings, store));
}

export function saveSettings(settings: TrailSettings): Promise<void> {
  return set(KEYS.settings, settings, store);
}

/** Codes the user marked found in this app, on top of what the Pocket Query says. */
export function loadLocallyFound(): Promise<Set<string>> {
  return loadCodes(KEYS.locallyFound);
}

export function updateLocallyFound(
  change: (codes: Set<string>) => ReadonlySet<string>,
): Promise<void> {
  return updateCodes(KEYS.locallyFound, change);
}

/** Codes the user never wants in a trail. */
export function loadIgnored(): Promise<Set<string>> {
  return loadCodes(KEYS.ignored);
}

export function updateIgnored(
  change: (codes: Set<string>) => ReadonlySet<string>,
): Promise<void> {
  return updateCodes(KEYS.ignored, change);
}

export async function loadWalk(): Promise<WalkState | undefined> {
  const stored: unknown = await get(KEYS.walk, store);
  return isWalkState(stored) ? stored : undefined;
}

/** undefined ends the walk and removes it. */
export function saveWalk(state: WalkState | undefined): Promise<void> {
  return state === undefined
    ? del(KEYS.walk, store)
    : set(KEYS.walk, state, store);
}

/** The stored list preferences, each one that is missing or unreadable at its default. */
export async function loadPreferences(): Promise<UiPreferences> {
  const stored: unknown = await get(KEYS.preferences, store);
  const value = isRecord(stored) ? stored : {};
  return {
    sort: (TRAIL_SORTS as readonly unknown[]).includes(value.sort)
      ? (value.sort as TrailSort)
      : DEFAULT_PREFERENCES.sort,
    showOtherCaches:
      typeof value.showOtherCaches === 'boolean'
        ? value.showOtherCaches
        : DEFAULT_PREFERENCES.showOtherCaches,
    walkingRoutes:
      typeof value.walkingRoutes === 'boolean'
        ? value.walkingRoutes
        : DEFAULT_PREFERENCES.walkingRoutes,
  };
}

export function savePreferences(preferences: UiPreferences): Promise<void> {
  return set(KEYS.preferences, preferences, store);
}

export async function loadImportInfo(): Promise<ImportInfo | undefined> {
  const stored: unknown = await get(KEYS.lastImport, store);
  if (
    !isRecord(stored) ||
    !isString(stored.at) ||
    !isStringArray(stored.fileNames)
  )
    return undefined;
  return {
    at: stored.at,
    cacheCount: Number.isFinite(stored.cacheCount)
      ? (stored.cacheCount as number)
      : 0,
    fileNames: stored.fileNames,
  };
}

export function saveImportInfo(info: ImportInfo): Promise<void> {
  return set(KEYS.lastImport, info, store);
}

const isWalkingMeters = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0;

function walkingDistancesFrom(stored: unknown): Map<string, number> {
  if (!(stored instanceof Map)) return new Map();
  return new Map(
    [...stored].filter(
      (entry): entry is [string, number] =>
        isString(entry[0]) && isWalkingMeters(entry[1]),
    ),
  );
}

/** Routed walking distances kept from earlier answers; Infinity, which IndexedDB keeps, where no path joins a pair. */
export async function loadWalkingDistances(): Promise<WalkingDistances> {
  return walkingDistancesFrom(await get(KEYS.walkingDistances, store));
}

/** Adds routed distances to the kept ones in one transaction, so what another tab added meanwhile stays. */
export function addWalkingDistances(
  entries: readonly [string, number][],
): Promise<void> {
  return update(
    KEYS.walkingDistances,
    (stored: unknown) => new Map([...walkingDistancesFrom(stored), ...entries]),
    store,
  );
}

/** Everything this app stored: caches, settings, found and ignored marks, the walk, preferences, the import record, the routed distances. */
export function clearAllData(): Promise<void> {
  return delMany(Object.values(KEYS), store);
}
