'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { loadWalkingDistances, saveWalkingDistances } from './data/store';
import { fetchWalkingDistances } from './data/walkingRoutes';
import type { Geocache } from './lib/geocache/types';
import { routingBatches } from './lib/routing/planRouting';
import {
  belowRequestCap,
  checkOf,
  nextRequest,
  nextRequestDelay,
  NO_REQUEST,
  type RouteCheck,
} from './lib/routing/requestPolicy';
import { DEFAULT_TRAIL_SETTINGS, type TrailSettings } from './lib/trails/types';
import {
  NO_WALKING_DISTANCES,
  type WalkingDistances,
} from './lib/trails/walkingDistances';

export type { RouteCheck } from './lib/routing/requestPolicy';

interface RouteInput {
  caches: readonly Geocache[];
  settings: TrailSettings;
  locallyFound: ReadonlySet<string>;
  /** The user opted in to sending trail caches' coordinates to the routing server. */
  enabled: boolean;
}

interface PlanInput extends RouteInput {
  distances: WalkingDistances;
}

function nothingToCancel() {}

// Nothing to plan, so the first paint never waits for the first plan.
const NO_PLAN_INPUT: PlanInput = {
  caches: [],
  settings: DEFAULT_TRAIL_SETTINGS,
  locallyFound: new Set(),
  enabled: false,
  distances: NO_WALKING_DISTANCES,
};

/** Routed walking distances for the trails' caches, planned in a deferred render, fetched one batch a second while enabled and kept in IndexedDB; `clear` forgets them all. */
export function useWalkingDistances({
  caches,
  settings,
  locallyFound,
  enabled,
}: RouteInput): {
  walkingDistances: WalkingDistances;
  check: RouteCheck;
  clear: () => void;
} {
  const [distances, setDistances] =
    useState<WalkingDistances>(NO_WALKING_DISTANCES);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  const [request, setRequest] = useState(NO_REQUEST);
  const lastRequestAt = useRef(-Infinity);
  // An answer merges into the latest distances, which the deferred plan may lag behind.
  const latest = useRef(NO_WALKING_DISTANCES);
  const cancelLoad = useRef(nothingToCancel);
  const cancelRequest = useRef(nothingToCancel);

  const keep = useCallback((next: WalkingDistances) => {
    latest.current = next;
    setDistances(next);
  }, []);

  // Turning it on again is a fresh try after a failure.
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    cancelLoad.current = cancel;
    loadWalkingDistances().then(
      (stored) => {
        if (cancelled) return;
        keep(stored);
        setLoaded(true);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return cancel;
  }, [keep]);

  const input = useMemo(
    () => ({ caches, settings, locallyFound, enabled, distances }),
    [caches, settings, locallyFound, enabled, distances],
  );
  const deferred = useDeferredValue(input, NO_PLAN_INPUT);
  const batches = useMemo(
    () =>
      deferred.enabled
        ? routingBatches(deferred.caches, {
            settings: deferred.settings,
            locallyFound: deferred.locallyFound,
            walkingDistances: deferred.distances,
          })
        : [],
    [deferred],
  );

  const next = nextRequest({
    // Until the stored distances are in, the batches are an estimate to show, not requests to send.
    mayRequest: enabled && loaded && !failed && belowRequestCap(requestCount),
    planned: deferred === input,
    batches,
    current: request,
  });
  if (next.url !== request.url) setRequest(next);

  useEffect(() => {
    if (request.caches.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        lastRequestAt.current = performance.now();
        setRequestCount((count) => count + 1);
        fetchWalkingDistances(request.caches, controller.signal).then(
          (entries) => {
            if (controller.signal.aborted) return;
            const merged = new Map([...latest.current, ...entries]);
            keep(merged);
            saveWalkingDistances(merged).catch(() => setFailed(true));
          },
          () => {
            // An abort is giving way to newer input or a clear, not a failure.
            if (!controller.signal.aborted) setFailed(true);
          },
        );
      },
      nextRequestDelay({
        lastRequestAt: lastRequestAt.current,
        now: performance.now(),
      }),
    );
    const cancel = () => {
      clearTimeout(timer);
      controller.abort();
    };
    cancelRequest.current = cancel;
    return cancel;
  }, [request, keep]);

  const clear = useCallback(() => {
    cancelLoad.current();
    cancelRequest.current();
    // The cancelled request is not pending any more: the same batch, planned again, is sent again.
    setRequest(NO_REQUEST);
    keep(NO_WALKING_DISTANCES);
    setLoaded(true);
  }, [keep]);

  return {
    walkingDistances: enabled ? distances : NO_WALKING_DISTANCES,
    // Off until a plan with routes on exists, so turning them on never flashes "done".
    check: checkOf({
      enabled: enabled && deferred.enabled,
      failed,
      remaining: batches.length,
      requestCount,
    }),
    clear,
  };
}
