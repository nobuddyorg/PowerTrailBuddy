// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  useApplePlatform,
  useMediaQuery,
  useNow,
  useOnline,
} from './useBrowserState';

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

describe('useApplePlatform', () => {
  const USER_AGENTS = {
    iPhone:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    iPadOS:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    Android:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    Windows:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  };
  const appleOn = (userAgent: string) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    return renderHook(() => useApplePlatform()).result.current;
  };

  it("tells Apple's devices, an iPad posing as a Mac among them, from the rest", () => {
    expect(appleOn(USER_AGENTS.iPhone)).toBe(true);
    expect(appleOn(USER_AGENTS.iPadOS)).toBe(true);
    expect(appleOn(USER_AGENTS.Android)).toBe(false);
    expect(appleOn(USER_AGENTS.Windows)).toBe(false);
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
  it('assumes online, a query that does not match, and no Apple device', () => {
    function Probe() {
      return `${useOnline()} ${useMediaQuery('(min-width: 1px)')} ${useApplePlatform()}`;
    }
    expect(renderToString(createElement(Probe))).toBe('true false false');
  });
});
