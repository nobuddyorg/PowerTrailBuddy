// @vitest-environment jsdom
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from './components/Toast/ToastProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { useFollow } from './useFollow';
import type { GeolocationState } from './useGeolocation';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>
    <ToastProvider>{children}</ToastProvider>
  </I18nProvider>
);

function renderFollow(location: GeolocationState, initiallyFollowing = false) {
  const start = vi.fn();
  const view = renderHook(
    () => useFollow({ location, start, initiallyFollowing }),
    { wrapper },
  );
  return { start, ...view };
}

beforeEach(() => localStorage.setItem('lang', 'en'));

describe('useFollow', () => {
  it('starts the position and follows it on locate, until the user pans', () => {
    const { result, start } = renderFollow({ status: 'idle' });
    expect(result.current.following).toBe(false);
    act(() => result.current.locate());
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.following).toBe(true);
    act(() => result.current.stopFollowing());
    expect(result.current.following).toBe(false);
  });

  it('can start out following, as a walk does', () => {
    const { result } = renderFollow({ status: 'waiting' }, true);
    expect(result.current.following).toBe(true);
  });

  it('explains a blocked or missing position instead of following', () => {
    for (const status of ['denied', 'unavailable'] as const) {
      const { result, start, unmount } = renderFollow({ status });
      act(() => result.current.locate());
      expect(start).not.toHaveBeenCalled();
      expect(result.current.following).toBe(false);
      expect(screen.getByTestId('toast')).toHaveTextContent(
        status === 'denied'
          ? /Location access is blocked/
          : 'Your position is not available right now.',
      );
      unmount();
    }
  });
});
