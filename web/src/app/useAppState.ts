'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { takeSharedFiles } from './data/sharedFiles';
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
  saveImportInfo,
  savePreferences,
  saveSettings,
  type ImportInfo,
  type UiPreferences,
} from './data/store';
import type { DataCore, StoredData } from './dataCore';
import { withBasePath } from './env';
import { importFiles, type ImportedFile } from './lib/geocache/importFiles';
import { mergeCaches } from './lib/geocache/mergeCaches';
import {
  isSharedLaunch,
  withoutSharedParam,
} from './lib/navigation/sharedLaunch';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './lib/trails/types';
import { useMarkActions } from './useMarkActions';
import { useWalkActions } from './useWalkActions';

export type AppError =
  'load-failed' | 'import-failed' | 'save-failed' | 'sample-failed';

export interface ImportSummary {
  /** Caches read from this import, before merging with what was there. */
  cacheCount: number;
  files: ImportedFile[];
}

const EMPTY_DATA: StoredData = {
  caches: [],
  settings: DEFAULT_TRAIL_SETTINGS,
  locallyFound: new Set(),
  ignored: new Set(),
  walk: undefined,
  preferences: DEFAULT_PREFERENCES,
  importInfo: undefined,
};

// Served from public/sample/: invented caches, the same two files a Pocket Query download holds.
const SAMPLE_FILES = [
  'powertrail-sample.gpx',
  'powertrail-sample-wpts.gpx',
] as const;

async function loadStoredData(): Promise<StoredData> {
  const [
    caches,
    settings,
    locallyFound,
    ignored,
    walk,
    preferences,
    importInfo,
  ] = await Promise.all([
    loadCaches(),
    loadSettings(),
    loadLocallyFound(),
    loadIgnored(),
    loadWalk(),
    loadPreferences(),
    loadImportInfo(),
  ]);
  return {
    caches,
    settings,
    locallyFound,
    ignored,
    walk,
    preferences,
    importInfo,
  };
}

async function fetchSampleFiles(): Promise<File[]> {
  return Promise.all(
    SAMPLE_FILES.map(async (name) => {
      const response = await fetch(withBasePath(`/sample/${name}`));
      if (!response.ok) throw new Error(`Sample ${name}: ${response.status}`);
      return new File([await response.blob()], name, {
        type: 'application/gpx+xml',
      });
    }),
  );
}

/** Everything the app keeps, loaded from and written back to browser storage, with the actions that change it. */
export function useAppState() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<StoredData>(EMPTY_DATA);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<ImportSummary>();
  const [error, setError] = useState<AppError>();
  // The latest data for actions that derive the next value and also store it, outside a state updater.
  const dataRef = useRef(data);

  const update = useCallback((next: Partial<StoredData>) => {
    dataRef.current = { ...dataRef.current, ...next };
    setData(dataRef.current);
  }, []);

  const persist = useCallback((write: Promise<void>) => {
    write.catch(() => setError('save-failed'));
  }, []);

  const core: DataCore = {
    current: useCallback(() => dataRef.current, []),
    update,
    persist,
  };

  const importSelected = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      setImporting(true);
      try {
        const result = await importFiles(files);
        const caches = mergeCaches(dataRef.current.caches, result.caches);
        const importInfo: ImportInfo = {
          at: new Date().toISOString(),
          cacheCount: result.caches.length,
          fileNames: result.files.map((file) => file.name),
        };
        update({ caches, importInfo });
        setLastImport({
          cacheCount: result.caches.length,
          files: result.files,
        });
        persist(saveCaches(caches));
        persist(saveImportInfo(importInfo));
      } catch {
        setError('import-failed');
      } finally {
        setImporting(false);
      }
    },
    [persist, update],
  );

  const importSample = useCallback(async () => {
    let files: File[];
    try {
      files = await fetchSampleFiles();
    } catch {
      setError('sample-failed');
      return;
    }
    await importSelected(files);
  }, [importSelected]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await loadStoredData();
        if (!cancelled) update(stored);
      } catch {
        if (!cancelled) setError('load-failed');
      }
      if (cancelled) return;
      setReady(true);
      if (!isSharedLaunch(window.location.search)) return;
      window.history.replaceState(
        window.history.state,
        '',
        withoutSharedParam(window.location.href),
      );
      try {
        await importSelected(await takeSharedFiles());
      } catch {
        setError('import-failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importSelected, update]);

  const applySettings = useCallback(
    (settings: TrailSettings) => {
      update({ settings });
      persist(saveSettings(settings));
    },
    [persist, update],
  );

  const setPreferences = useCallback(
    (change: Partial<UiPreferences>) => {
      const preferences = { ...dataRef.current.preferences, ...change };
      update({ preferences });
      persist(savePreferences(preferences));
    },
    [persist, update],
  );

  const clearData = useCallback(async () => {
    try {
      await clearAllData();
      update(EMPTY_DATA);
      setLastImport(undefined);
    } catch {
      setError('save-failed');
    }
  }, [update]);

  return {
    ready,
    ...data,
    importing,
    lastImport,
    error,
    importFiles: importSelected,
    importSample,
    applySettings,
    setPreferences,
    clearData,
    ...useMarkActions(core),
    ...useWalkActions(core),
    dismissImport: useCallback(() => setLastImport(undefined), []),
    dismissError: useCallback(() => setError(undefined), []),
  };
}

export type AppState = ReturnType<typeof useAppState>;
