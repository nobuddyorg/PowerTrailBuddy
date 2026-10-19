// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeCaches } from './lib/ui-logic/ui.test-support';
import { DEFAULT_TRAIL_SETTINGS } from './lib/trails/types';
import { useTrails } from './useTrails';

const SETTINGS = { ...DEFAULT_TRAIL_SETTINGS, minCaches: 3 };
const CACHES = makeCaches(4, 'GCHOOK');

describe('useTrails', () => {
  it('finds the trails in the data, after the first paint', async () => {
    const { result } = renderHook(() =>
      useTrails({
        caches: CACHES,
        settings: SETTINGS,
        locallyFound: new Set(),
      }),
    );
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.trails).toHaveLength(1);
    expect(result.current.trails[0].caches).toHaveLength(4);
  });

  it('leaves out the caches marked found here', async () => {
    const locallyFound = new Set(['GCHOOK1', 'GCHOOK2']);
    const { result } = renderHook(() =>
      useTrails({ caches: CACHES, settings: SETTINGS, locallyFound }),
    );
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.trails).toEqual([]);
  });

  it('follows a change of settings', async () => {
    const locallyFound = new Set<string>();
    const { result, rerender } = renderHook(
      ({ settings }) => useTrails({ caches: CACHES, settings, locallyFound }),
      {
        initialProps: { settings: SETTINGS },
      },
    );
    await waitFor(() => expect(result.current.trails).toHaveLength(1));
    rerender({ settings: { ...SETTINGS, minCaches: 5 } });
    await waitFor(() => expect(result.current.trails).toEqual([]));
    expect(result.current.pending).toBe(false);
  });
});
