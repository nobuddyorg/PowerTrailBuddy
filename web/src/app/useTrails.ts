'use client';

import { useDeferredValue, useMemo } from 'react';

import type { Geocache } from './lib/geocache/types';
import { findTrails } from './lib/trails/findTrails';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './lib/trails/types';

interface TrailInput {
  caches: readonly Geocache[];
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
}

// Nothing to search, so the first paint never waits for the first search.
const NO_INPUT: TrailInput = {
  caches: [],
  settings: DEFAULT_TRAIL_SETTINGS,
  locallyFound: new Set(),
};

/**
 * The trails for the current data, computed in a deferred render so a settings change or a found
 * mark never blocks the interaction that caused it; `pending` while the shown trails are stale.
 */
export function useTrails({ caches, settings, locallyFound }: TrailInput) {
  const input = useMemo(
    () => ({ caches, settings, locallyFound }),
    [caches, settings, locallyFound],
  );
  const deferred = useDeferredValue(input, NO_INPUT);
  const trails = useMemo(
    () => findTrails(deferred.caches, deferred.settings, deferred.locallyFound),
    [deferred],
  );
  return { trails, pending: deferred !== input };
}
