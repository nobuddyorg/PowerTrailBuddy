'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { loadWalkingDistances, saveWalkingDistances } from './data/store';
import { fetchWalkingDistances } from './data/walkingRoutes';
import type { Geocache } from './lib/geocache/types';
import { routingBatches } from './lib/routing/planRouting';
import type { TrailSettings } from './lib/trails/types';
import {
  NO_WALKING_DISTANCES,
  type WalkingDistances,
} from './lib/trails/walkingDistances';

/** FOSSGIS's policy: one request a second at most. */
const REQUEST_INTERVAL_MS = 1000;

/** Requests per page load: the trails of a few Pocket Queries, never heavy use of a volunteer-run server. */
export const MAX_REQUESTS = 60;

export type RouteCheck =
  | { status: 'off' }
  | { status: 'checking'; remaining: number }
  | { status: 'done' }
  | { status: 'failed' }
  | { status: 'limited' };

interface RouteInput {
  caches: readonly Geocache[];
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
  /** The user opted in to sending trail caches' coordinates to the routing server. */
  enabled: boolean;
}

function checkOf({
  enabled,
  failed,
  remaining,
  requestCount,
}: {
  enabled: boolean;
  failed: boolean;
  remaining: number;
  requestCount: number;
}): RouteCheck {
  if (!enabled) return { status: 'off' };
  if (failed) return { status: 'failed' };
  if (remaining === 0) return { status: 'done' };
  if (requestCount >= MAX_REQUESTS) return { status: 'limited' };
  return { status: 'checking', remaining };
}

/** Routed walking distances for the trails' caches, fetched one batch a second while enabled and kept in IndexedDB. */
export function useWalkingDistances({
  caches,
  settings,
  locallyFound,
  enabled,
}: RouteInput): { walkingDistances: WalkingDistances; check: RouteCheck } {
  const [distances, setDistances] =
    useState<WalkingDistances>(NO_WALKING_DISTANCES);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  const lastRequestAt = useRef(-Infinity);

  // Turning it on again is a fresh try after a failure.
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    loadWalkingDistances().then(
      (stored) => {
        if (cancelled) return;
        setDistances(stored);
        setLoaded(true);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const batches = useMemo(
    () =>
      enabled
        ? routingBatches(caches, {
            settings,
            locallyFound,
            walkingDistances: distances,
          })
        : [],
    [enabled, caches, settings, locallyFound, distances],
  );

  // Until the stored distances are in, the batches are an estimate to show, not requests to send.
  const canRequest = loaded && !failed && requestCount < MAX_REQUESTS;
  const next = canRequest ? batches[0] : undefined;

  useEffect(() => {
    if (next === undefined) return;
    const controller = new AbortController();
    const wait = Math.max(
      0,
      lastRequestAt.current + REQUEST_INTERVAL_MS - performance.now(),
    );
    const timer = setTimeout(() => {
      lastRequestAt.current = performance.now();
      setRequestCount((count) => count + 1);
      fetchWalkingDistances(next, controller.signal).then(
        (entries) => {
          const merged = new Map([...distances, ...entries]);
          setDistances(merged);
          saveWalkingDistances(merged).catch(() => setFailed(true));
        },
        () => {
          // An abort is this effect giving way to newer input, not a failure.
          if (!controller.signal.aborted) setFailed(true);
        },
      );
    }, wait);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [next, distances]);

  return {
    walkingDistances: enabled ? distances : NO_WALKING_DISTANCES,
    check: checkOf({
      enabled,
      failed,
      remaining: batches.length,
      requestCount,
    }),
  };
}
