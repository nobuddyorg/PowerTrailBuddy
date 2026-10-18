import type { Geocache } from '../lib/geocache/types';
import type { TrailSettings } from '../lib/trails/types';
import type { WalkState } from '../lib/walk/walk';

// The only module that imports idb-keyval (dependency-cruiser's storage-behind-data-layer); keys: docs/reference/architecture.md.

const notImplemented = () => Promise.reject(new Error('not implemented'));

export function loadCaches(): Promise<Geocache[]> {
  return notImplemented();
}

export function saveCaches(caches: readonly Geocache[]): Promise<void> {
  void caches;
  return notImplemented();
}

/** Stored settings with the defaults filled in for anything missing. */
export function loadSettings(): Promise<TrailSettings> {
  return notImplemented();
}

export function saveSettings(settings: TrailSettings): Promise<void> {
  void settings;
  return notImplemented();
}

/** Codes the user marked found in this app, on top of what the Pocket Query says. */
export function loadLocallyFound(): Promise<Set<string>> {
  return notImplemented();
}

export function saveLocallyFound(codes: ReadonlySet<string>): Promise<void> {
  void codes;
  return notImplemented();
}

export function loadWalk(): Promise<WalkState | undefined> {
  return notImplemented();
}

/** undefined ends the walk and removes it. */
export function saveWalk(state: WalkState | undefined): Promise<void> {
  void state;
  return notImplemented();
}

/** Everything this app stored: caches, settings, found marks, the walk. */
export function clearAllData(): Promise<void> {
  return notImplemented();
}
