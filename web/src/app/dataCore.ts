import type { ImportInfo, UiPreferences } from './data/store';
import type { Geocache } from './lib/geocache/types';
import type { TrailSettings } from './lib/trails/types';
import type { WalkState } from './lib/walk/walk';

/** Everything the app keeps in browser storage, as the hooks hold it. */
export interface StoredData {
  caches: Geocache[];
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  walk: WalkState | undefined;
  preferences: UiPreferences;
  importInfo: ImportInfo | undefined;
}

/** What the action hooks share: the latest data, a way to change it, and a way to store a change. */
export interface DataCore {
  current: () => StoredData;
  update: (next: Partial<StoredData>) => void;
  persist: (write: Promise<void>) => void;
}
