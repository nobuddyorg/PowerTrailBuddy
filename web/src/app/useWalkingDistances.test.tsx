// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Geocache } from './lib/geocache/types';
import { DEFAULT_TRAIL_SETTINGS } from './lib/trails/types';
import { pairKey } from './lib/trails/walkingDistances';
import { makeCaches } from './lib/ui-logic/ui.test-support';
import { memoryIdb, storedValue, storeValue } from './memoryIdb.test-support';
import { MAX_REQUESTS } from './lib/routing/requestPolicy';
import { useWalkingDistances } from './useWalkingDistances';

vi.mock('idb-keyval', () => import('./memoryIdb.test-support'));

const router = vi.hoisted(() => ({
  fetch:
    vi.fn<
      (
        caches: readonly Geocache[],
        signal: AbortSignal,
      ) => Promise<[string, number][]>
    >(),
}));
vi.mock('./data/walkingRoutes', () => ({
  fetchWalkingDistances: router.fetch,
}));

/** Every pair among the caches at the same walking distance, as the router would answer. */
function answerFor(
  caches: readonly Geocache[],
  meters = 120,
): [string, number][] {
  return caches.flatMap((cache, index) =>
    caches
      .slice(index + 1)
      .map((other): [string, number] => [pairKey(cache, other), meters]),
  );
}

const SETTINGS = { ...DEFAULT_TRAIL_SETTINGS, minCaches: 3 };
const CACHES = makeCaches(4, 'GCROUTE');
const nothingFound = new Set<string>();

function renderRoutes(enabled = true, caches: readonly Geocache[] = CACHES) {
  return renderHook(
    (props: { enabled: boolean; caches: readonly Geocache[] }) =>
      useWalkingDistances({
        caches: props.caches,
        settings: SETTINGS,
        locallyFound: nothingFound,
        enabled: props.enabled,
      }),
    { initialProps: { enabled, caches } },
  );
}

beforeEach(() => {
  memoryIdb.reset();
  router.fetch
    .mockReset()
    .mockImplementation((caches) => Promise.resolve(answerFor(caches)));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWalkingDistances', () => {
  it('asks nothing and routes nothing while off, even with distances stored', async () => {
    storeValue('walking-distances', new Map(answerFor(CACHES)));
    const { result } = renderRoutes(false);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(router.fetch).not.toHaveBeenCalled();
    expect(result.current.check).toEqual({ status: 'off' });
    expect(result.current.walkingDistances.size).toBe(0);
  });

  it('routes the trail caches once on, then keeps the answer', async () => {
    const { result } = renderRoutes();
    await waitFor(() =>
      expect(result.current.check).toEqual({ status: 'done' }),
    );
    expect(router.fetch).toHaveBeenCalledTimes(1);
    expect(
      router.fetch.mock.calls[0][0].map((cache) => cache.code).sort(),
    ).toEqual(['GCROUTE1', 'GCROUTE2', 'GCROUTE3', 'GCROUTE4']);
    expect(result.current.walkingDistances).toEqual(
      new Map(answerFor(router.fetch.mock.calls[0][0])),
    );
    await waitFor(() =>
      expect(storedValue('walking-distances')).toEqual(
        result.current.walkingDistances,
      ),
    );
  });

  it('says it is checking, and how many requests are left, while it waits for an answer', async () => {
    router.fetch.mockImplementation(() => new Promise(() => {}));
    const { result } = renderRoutes();
    await waitFor(() => expect(router.fetch).toHaveBeenCalled());
    expect(result.current.check).toEqual({ status: 'checking', remaining: 1 });
  });

  it('asks nothing for pairs routed in an earlier session', async () => {
    storeValue('walking-distances', new Map(answerFor(CACHES)));
    const { result } = renderRoutes();
    await waitFor(() =>
      expect(result.current.check).toEqual({ status: 'done' }),
    );
    expect(router.fetch).not.toHaveBeenCalled();
    expect(result.current.walkingDistances.size).toBe(6);
  });

  it('waits a second between requests', async () => {
    const elsewhere = makeCaches(4, 'GCFAR').map((cache) => ({
      ...cache,
      latitude: cache.latitude + 1,
    }));
    const startedAt: number[] = [];
    router.fetch.mockImplementation((caches) => {
      startedAt.push(performance.now());
      return Promise.resolve(answerFor(caches));
    });
    const { result } = renderRoutes(true, [...CACHES, ...elsewhere]);
    await waitFor(
      () => expect(result.current.check).toEqual({ status: 'done' }),
      { timeout: 3000 },
    );
    expect(startedAt).toHaveLength(2);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(990);
  });

  it('reports a failed request, and tries again when turned off and on', async () => {
    router.fetch.mockRejectedValueOnce(new Error('Routing server: 503'));
    const { result, rerender } = renderRoutes();
    await waitFor(() =>
      expect(result.current.check).toEqual({ status: 'failed' }),
    );
    expect(result.current.walkingDistances.size).toBe(0);
    rerender({ enabled: false, caches: CACHES });
    expect(result.current.check).toEqual({ status: 'off' });
    rerender({ enabled: true, caches: CACHES });
    await waitFor(
      () => expect(result.current.check).toEqual({ status: 'done' }),
      { timeout: 3000 },
    );
  });

  it('does not count a request it gave up for newer input as a failure', async () => {
    router.fetch.mockImplementationOnce(
      (_caches, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    );
    const { result, rerender } = renderRoutes();
    await waitFor(() => expect(router.fetch).toHaveBeenCalledTimes(1));
    rerender({ enabled: true, caches: CACHES.slice(0, 3) });
    await waitFor(
      () => expect(result.current.check).toEqual({ status: 'done' }),
      { timeout: 3000 },
    );
    expect(router.fetch.mock.calls[0][1].aborted).toBe(true);
  });

  it('reports storage it cannot read or write', async () => {
    memoryIdb.refuseReads = true;
    const unread = renderRoutes();
    await waitFor(() =>
      expect(unread.result.current.check).toEqual({ status: 'failed' }),
    );
    expect(router.fetch).not.toHaveBeenCalled();
    unread.unmount();

    memoryIdb.reset();
    memoryIdb.refuseWrites = true;
    const unwritten = renderRoutes();
    await waitFor(() =>
      expect(unwritten.result.current.check).toEqual({ status: 'failed' }),
    );
    expect(unwritten.result.current.walkingDistances.size).toBe(6);
  });

  it('does nothing with storage that answers after it is gone', async () => {
    storeValue('walking-distances', new Map(answerFor(CACHES)));
    renderRoutes().unmount();
    memoryIdb.refuseReads = true;
    renderRoutes().unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(router.fetch).not.toHaveBeenCalled();
  });

  it(`stops after ${MAX_REQUESTS} requests in one visit`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    // One group, and so one request, more than a visit may ask for.
    const groups = Array.from({ length: MAX_REQUESTS + 1 }, (_, index) =>
      makeCaches(3, `GCCAP${index}X`).map((cache) => ({
        ...cache,
        latitude: cache.latitude + index / 10,
      })),
    ).flat();
    const { result } = renderRoutes(true, groups);
    for (let second = 0; second <= MAX_REQUESTS + 5; second++) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(router.fetch).toHaveBeenCalledTimes(MAX_REQUESTS);
    expect(result.current.check).toEqual({ status: 'limited' });
  });

  it('never gives up and sends again a batch whose caches are unchanged', async () => {
    router.fetch.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderRoutes();
    await waitFor(() => expect(router.fetch).toHaveBeenCalledTimes(1));
    rerender({ enabled: true, caches: CACHES.map((cache) => ({ ...cache })) });
    await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
    expect(router.fetch).toHaveBeenCalledTimes(1);
    expect(router.fetch.mock.calls[0][1].aborted).toBe(false);
  });

  it('forgets every routed pair on a clear, and stores none of them again, whatever is in flight', async () => {
    const later = makeCaches(4, 'GCLATER').map((cache) => ({
      ...cache,
      latitude: cache.latitude + 1,
    }));
    const { result, rerender } = renderRoutes();
    await waitFor(() =>
      expect(result.current.check).toEqual({ status: 'done' }),
    );
    let answer = () => {};
    router.fetch.mockImplementationOnce(
      (caches) =>
        new Promise((resolve) => {
          answer = () => resolve(answerFor(caches));
        }),
    );
    rerender({ enabled: true, caches: [...CACHES, ...later] });
    await waitFor(() => expect(router.fetch).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    });

    // As Clear all data does: forget, empty the store, then the caches.
    act(() => result.current.clear());
    memoryIdb.values.clear();
    rerender({ enabled: true, caches: [] });
    await act(async () => answer());
    expect(router.fetch.mock.calls[1][1].aborted).toBe(true);
    expect(result.current.walkingDistances.size).toBe(0);
    expect(storedValue('walking-distances')).toBeUndefined();

    rerender({ enabled: true, caches: later });
    await waitFor(
      () => expect(result.current.check).toEqual({ status: 'done' }),
      { timeout: 3000 },
    );
    expect(storedValue('walking-distances')).toEqual(
      new Map(answerFor(router.fetch.mock.calls[2][0])),
    );
  });

  it('drops stored pairs that a clear overtakes on their way in', async () => {
    storeValue('walking-distances', new Map(answerFor(CACHES)));
    const { result } = renderRoutes();
    act(() => result.current.clear());
    await waitFor(() =>
      expect(result.current.check).toEqual({ status: 'done' }),
    );
    expect(router.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.walkingDistances).toEqual(
      new Map(answerFor(router.fetch.mock.calls[0][0])),
    );
  });
});
