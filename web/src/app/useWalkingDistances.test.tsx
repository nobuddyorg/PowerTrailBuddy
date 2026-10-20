// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Geocache } from './lib/geocache/types';
import { DEFAULT_TRAIL_SETTINGS } from './lib/trails/types';
import { pairKey } from './lib/trails/walkingDistances';
import { makeCaches } from './lib/ui-logic/ui.test-support';
import { memoryIdb, storedValue, storeValue } from './memoryIdb.test-support';
import { MAX_REQUESTS, useWalkingDistances } from './useWalkingDistances';

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

  it('sends a request once though its caches come again as a new list, and uses its answer', async () => {
    let answer: (entries: [string, number][]) => void = () => {};
    router.fetch.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const { result, rerender } = renderRoutes();
    await waitFor(() => expect(router.fetch).toHaveBeenCalledTimes(1));
    rerender({ enabled: true, caches: [...CACHES] });
    await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
    expect(router.fetch).toHaveBeenCalledTimes(1);
    expect(router.fetch.mock.calls[0][1].aborted).toBe(false);

    act(() => answer(answerFor(CACHES)));
    await waitFor(() =>
      expect(result.current.check).toEqual({ status: 'done' }),
    );
    expect(router.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps a request it sent when the caches change, and asks for the rest after its answer', async () => {
    let answer: (entries: [string, number][]) => void = () => {};
    router.fetch.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const { result, rerender } = renderRoutes();
    await waitFor(() => expect(router.fetch).toHaveBeenCalledTimes(1));
    const moved = { ...CACHES[3], code: 'GCROUTE9' };
    rerender({ enabled: true, caches: [...CACHES.slice(0, 3), moved] });
    await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));
    expect(router.fetch).toHaveBeenCalledTimes(1);

    act(() => answer(answerFor(CACHES)));
    await waitFor(
      () => expect(result.current.check).toEqual({ status: 'done' }),
      { timeout: 3000 },
    );
    expect(router.fetch).toHaveBeenCalledTimes(2);
    expect(
      result.current.walkingDistances.get(pairKey(CACHES[0], CACHES[1])),
    ).toBe(120);
  });

  it('drops a request when turned off, without counting it a failure', async () => {
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
    rerender({ enabled: false, caches: CACHES });
    expect(router.fetch.mock.calls[0][1].aborted).toBe(true);
    rerender({ enabled: true, caches: CACHES });
    await waitFor(
      () => expect(result.current.check).toEqual({ status: 'done' }),
      { timeout: 3000 },
    );
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
    // An answer that routes nothing leaves the batch to ask for forever.
    router.fetch.mockImplementation(() => Promise.resolve([]));
    const { result } = renderRoutes();
    for (let second = 0; second <= MAX_REQUESTS + 5; second++) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(router.fetch).toHaveBeenCalledTimes(MAX_REQUESTS);
    expect(result.current.check).toEqual({ status: 'limited' });
  });
});
