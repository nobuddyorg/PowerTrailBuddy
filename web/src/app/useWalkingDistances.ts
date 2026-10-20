'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { addWalkingDistances, loadWalkingDistances } from './data/store';
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
  const [inFlight, setInFlight] = useState(false);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  const [request, setRequest] = useState(NO_REQUEST);
  const lastRequestAt = useRef(-Infinity);
  // An answer merges into the latest distances, which the deferred plan may lag behind.
  const latest = useRef(NO_WALKING_DISTANCES);
  // Aborted by a clear, so stored pairs it overtakes never come back.
  const loading = useRef(new AbortController());
  // Aborts what was sent: turning routes off, leaving the page or a clear, never newer input.
  const sent = useRef(new AbortController());

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
    const controller = new AbortController();
    loading.current = controller;
    const { signal } = controller;
    loadWalkingDistances().then(
      (stored) => {
        if (signal.aborted) return;
        keep(stored);
        setLoaded(true);
      },
      () => {
        if (!signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [keep]);

  // A request already sent is answered even if the input moves on; only turning routes off or leaving drops it.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    sent.current = controller;
    return () => {
      controller.abort();
      setInFlight(false);
    };
  }, [enabled]);

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
    mayRequest:
      enabled &&
      loaded &&
      !failed &&
      !inFlight &&
      belowRequestCap(requestCount),
    planned: deferred === input,
    batches,
    current: request,
  });
  if (next.url !== request.url) setRequest(next);

  useEffect(() => {
    if (request.caches.length === 0) return;
    const timer = setTimeout(
      () => {
        const controller = sent.current;
        const { signal } = controller;
        lastRequestAt.current = performance.now();
        setRequestCount((count) => count + 1);
        setInFlight(true);
        fetchWalkingDistances(request.caches, signal)
          .then(
            (entries) => {
              if (signal.aborted) return;
              keep(new Map([...latest.current, ...entries]));
              addWalkingDistances(entries).catch(() => setFailed(true));
            },
            () => {
              // An abort is routes turned off, the page left or a clear, not a failure.
              if (!signal.aborted) setFailed(true);
            },
          )
          .finally(() => {
            // A clear has already moved on to a fresh controller and let the next request go.
            if (sent.current === controller) setInFlight(false);
          });
      },
      nextRequestDelay({
        lastRequestAt: lastRequestAt.current,
        now: performance.now(),
      }),
    );
    // Only a request not yet sent gives way to newer input; one sent is answered.
    return () => clearTimeout(timer);
  }, [request, keep]);

  const clear = useCallback(() => {
    loading.current.abort();
    sent.current.abort();
    sent.current = new AbortController();
    setInFlight(false);
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
