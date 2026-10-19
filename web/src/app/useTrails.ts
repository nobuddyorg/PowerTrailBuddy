'use client';

import { useDeferredValue, useMemo } from 'react';

import type { Geocache } from './lib/geocache/types';
import { findTrails } from './lib/trails/findTrails';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './lib/trails/types';
import {
  NO_WALKING_DISTANCES,
  type WalkingDistances,
} from './lib/trails/walkingDistances';

interface TrailInput {
  caches: readonly Geocache[];
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
  walkingDistances: WalkingDistances;
}

// Nothing to search, so the first paint never waits for the first search.
const NO_INPUT: TrailInput = {
  caches: [],
  settings: DEFAULT_TRAIL_SETTINGS,
  locallyFound: new Set(),
  walkingDistances: NO_WALKING_DISTANCES,
};

/** Computed in a deferred render, so no settings change or found mark waits for it; `pending` while stale. */
export function useTrails({
  caches,
  settings,
  locallyFound,
  walkingDistances,
}: TrailInput) {
  const input = useMemo(
    () => ({ caches, settings, locallyFound, walkingDistances }),
    [caches, settings, locallyFound, walkingDistances],
  );
  const deferred = useDeferredValue(input, NO_INPUT);
  const trails = useMemo(
    () =>
      findTrails(deferred.caches, {
        settings: deferred.settings,
        locallyFound: deferred.locallyFound,
        walkingDistances: deferred.walkingDistances,
      }),
    [deferred],
  );
  return { trails, pending: deferred !== input };
}
