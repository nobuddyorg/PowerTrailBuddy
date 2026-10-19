// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeCaches } from './lib/ui-logic/ui.test-support';
import { DEFAULT_TRAIL_SETTINGS } from './lib/trails/types';
import { NO_WALKING_DISTANCES, pairKey } from './lib/trails/walkingDistances';
import { useTrails } from './useTrails';

const SETTINGS = { ...DEFAULT_TRAIL_SETTINGS, minCaches: 3 };
const CACHES = makeCaches(4, 'GCHOOK');
const walkingDistances = NO_WALKING_DISTANCES;

describe('useTrails', () => {
  it('finds the trails in the data, after the first paint', async () => {
    const { result } = renderHook(() =>
      useTrails({
        caches: CACHES,
        settings: SETTINGS,
        locallyFound: new Set(),
        walkingDistances,
      }),
    );
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.trails).toHaveLength(1);
    expect(result.current.trails[0].caches).toHaveLength(4);
  });

  it('leaves out the caches marked found here', async () => {
    const locallyFound = new Set(['GCHOOK1', 'GCHOOK2']);
    const { result } = renderHook(() =>
      useTrails({
        caches: CACHES,
        settings: SETTINGS,
        locallyFound,
        walkingDistances,
      }),
    );
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.trails).toEqual([]);
  });

  it('follows a change of settings', async () => {
    const locallyFound = new Set<string>();
    const { result, rerender } = renderHook(
      ({ settings }) =>
        useTrails({ caches: CACHES, settings, locallyFound, walkingDistances }),
      {
        initialProps: { settings: SETTINGS },
      },
    );
    await waitFor(() => expect(result.current.trails).toHaveLength(1));
    rerender({ settings: { ...SETTINGS, minCaches: 5 } });
    await waitFor(() => expect(result.current.trails).toEqual([]));
    expect(result.current.pending).toBe(false);
  });

  it('follows new walking distances: a pair no path joins splits the trail', async () => {
    const locallyFound = new Set<string>();
    const { result, rerender } = renderHook(
      ({ distances }) =>
        useTrails({
          caches: CACHES,
          settings: { ...SETTINGS, minCaches: 2 },
          locallyFound,
          walkingDistances: distances,
        }),
      { initialProps: { distances: walkingDistances } },
    );
    await waitFor(() => expect(result.current.trails).toHaveLength(1));
    const [, second, third] = result.current.trails[0].caches;
    rerender({
      distances: new Map([[pairKey(second, third), Infinity]]),
    });
    await waitFor(() => expect(result.current.trails).toHaveLength(2));
  });
});
