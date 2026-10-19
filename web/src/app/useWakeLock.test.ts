// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWakeLock } from './useWakeLock';

const lock = { release: vi.fn(() => Promise.resolve()) };
const wakeLock = { request: vi.fn(() => Promise.resolve(lock)) };
let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  visibility = 'visible';
  lock.release.mockClear();
  wakeLock.request.mockReset().mockResolvedValue(lock);
  Object.defineProperty(navigator, 'wakeLock', {
    value: wakeLock,
    configurable: true,
  });
  Object.defineProperty(document, 'visibilityState', {
    get: () => visibility,
    configurable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useWakeLock', () => {
  it('keeps the screen on while active and lets go at the end', async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });
    await act(() => Promise.resolve());
    expect(wakeLock.request).toHaveBeenCalledWith('screen');
    rerender({ active: false });
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing while inactive', () => {
    renderHook(() => useWakeLock(false));
    expect(wakeLock.request).not.toHaveBeenCalled();
  });

  it('takes the lock again when the page comes back, not while hidden', async () => {
    renderHook(() => useWakeLock(true));
    await act(() => Promise.resolve());
    act(() => setVisibility('hidden'));
    expect(wakeLock.request).toHaveBeenCalledTimes(1);
    act(() => setVisibility('visible'));
    expect(wakeLock.request).toHaveBeenCalledTimes(2);
  });

  it('releases a lock that arrives after the walk ended', async () => {
    let grant: (value: typeof lock) => void = () => {};
    wakeLock.request.mockReturnValue(
      new Promise((resolve) => (grant = resolve)),
    );
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    await act(async () => grant(lock));
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('carries on when the browser refuses the lock', async () => {
    wakeLock.request.mockRejectedValue(
      new DOMException('low battery', 'NotAllowedError'),
    );
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(() => Promise.resolve());
    unmount();
    expect(lock.release).not.toHaveBeenCalled();
  });

  it('does nothing in a browser without wake locks', () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => renderHook(() => useWakeLock(true)).unmount()).not.toThrow();
  });
});
