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

// The second request waits out the one-second gap; a fake clock passes it at once.
const FAKE_CLOCK: Parameters<typeof vi.useFakeTimers>[0] = {
  toFake: ['setTimeout', 'clearTimeout', 'performance'],
};

/** Passes time in short steps, each its own act, so every answer renders before the next timer. */
async function elapse(milliseconds: number) {
  for (let passed = 0; passed < milliseconds; passed += 100) {
    await act(() => vi.advanceTimersByTimeAsync(100));
  }
}

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
    vi.useFakeTimers(FAKE_CLOCK);
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
    await elapse(3000);
    expect(result.current.check).toEqual({ status: 'done' });
    expect(startedAt).toHaveLength(2);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(1000);
  });

  it('reports a failed request, and tries again when turned off and on', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    router.fetch.mockRejectedValueOnce(new Error('Routing server: 503'));
    const { result, rerender } = renderRoutes();
    await elapse(500);
    expect(result.current.check).toEqual({ status: 'failed' });
    expect(result.current.walkingDistances.size).toBe(0);
    rerender({ enabled: false, caches: CACHES });
    expect(result.current.check).toEqual({ status: 'off' });
    rerender({ enabled: true, caches: CACHES });
    await elapse(1500);
    expect(result.current.check).toEqual({ status: 'done' });
  });

  it('does not count a request it gave up for newer input as a failure', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    router.fetch.mockImplementationOnce(
      (_caches, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    );
    const { result, rerender } = renderRoutes();
    await elapse(500);
    expect(router.fetch).toHaveBeenCalledTimes(1);
    rerender({ enabled: true, caches: CACHES.slice(0, 3) });
    await elapse(1500);
    expect(result.current.check).toEqual({ status: 'done' });
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
    vi.useFakeTimers(FAKE_CLOCK);
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
    vi.useFakeTimers(FAKE_CLOCK);
    router.fetch.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderRoutes();
    await elapse(500);
    expect(router.fetch).toHaveBeenCalledTimes(1);
    rerender({ enabled: true, caches: CACHES.map((cache) => ({ ...cache })) });
    await elapse(1500);
    expect(router.fetch).toHaveBeenCalledTimes(1);
    expect(router.fetch.mock.calls[0][1].aborted).toBe(false);
  });

  it('forgets every routed pair on a clear, and stores none of them again, whatever is in flight', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    const later = makeCaches(4, 'GCLATER').map((cache) => ({
      ...cache,
      latitude: cache.latitude + 1,
    }));
    const { result, rerender } = renderRoutes();
    await elapse(500);
    expect(result.current.check).toEqual({ status: 'done' });
    let answer = () => {};
    router.fetch.mockImplementationOnce(
      (caches) =>
        new Promise((resolve) => {
          answer = () => resolve(answerFor(caches));
        }),
    );
    rerender({ enabled: true, caches: [...CACHES, ...later] });
    await elapse(1500);
    expect(router.fetch).toHaveBeenCalledTimes(2);

    // As Clear all data does: forget, empty the store, then the caches.
    act(() => result.current.clear());
    memoryIdb.values.clear();
    rerender({ enabled: true, caches: [] });
    await act(async () => answer());
    expect(router.fetch.mock.calls[1][1].aborted).toBe(true);
    expect(result.current.walkingDistances.size).toBe(0);
    expect(storedValue('walking-distances')).toBeUndefined();

    rerender({ enabled: true, caches: later });
    await elapse(1500);
    expect(result.current.check).toEqual({ status: 'done' });
    expect(storedValue('walking-distances')).toEqual(
      new Map(answerFor(router.fetch.mock.calls[2][0])),
    );
  });

  it('asks again after a clear that left the caches in place, as a failed Clear all data does', async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    router.fetch.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderRoutes();
    await elapse(500);
    expect(router.fetch).toHaveBeenCalledTimes(1);

    act(() => result.current.clear());

    await elapse(1500);
    expect(router.fetch).toHaveBeenCalledTimes(2);
    expect(router.fetch.mock.calls[1][0]).toEqual(
      router.fetch.mock.calls[0][0],
    );
    expect(result.current.check).toEqual({ status: 'done' });
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
