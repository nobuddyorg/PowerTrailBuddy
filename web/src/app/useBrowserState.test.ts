// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMediaQuery, useNow, useOnline } from './useBrowserState';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useOnline', () => {
  it('follows the browser going offline and back', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(result.current).toBe(false);
    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(true);
  });
});

describe('useMediaQuery', () => {
  it('answers the query and follows its changes', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          get matches() {
            return query === '(min-width: 1024px)' && matches;
          },
          addEventListener: (_: string, listener: () => void) =>
            listeners.add(listener),
          removeEventListener: (_: string, listener: () => void) =>
            listeners.delete(listener),
        }) as unknown as MediaQueryList,
    );
    const { result, unmount } = renderHook(() =>
      useMediaQuery('(min-width: 1024px)'),
    );
    expect(result.current).toBe(false);
    matches = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });
});

describe('useNow', () => {
  it('ticks while active and stands still otherwise', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { result, rerender } = renderHook(
      ({ active }) => useNow(5_000, active),
      {
        initialProps: { active: true },
      },
    );
    expect(result.current).toBe(1_000_000);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(1_005_000);
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current).toBe(1_005_000);
  });
});

describe('the static prerender', () => {
  it('assumes online and a query that does not match', () => {
    function Probe() {
      return `${useOnline()} ${useMediaQuery('(min-width: 1px)')}`;
    }
    expect(renderToString(createElement(Probe))).toBe('true false');
  });
});
