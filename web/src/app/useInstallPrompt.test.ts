// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useInstallPrompt } from './useInstallPrompt';

function offer(prompt = vi.fn(() => Promise.resolve())) {
  const event = Object.assign(
    new Event('beforeinstallprompt', { cancelable: true }),
    { prompt },
  );
  act(() => void window.dispatchEvent(event));
  return { event, prompt };
}

describe('useInstallPrompt', () => {
  it('offers nothing until the browser does', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    act(() => result.current.install());
    expect(result.current.canInstall).toBe(false);
  });

  it('keeps the browser’s offer for the button and uses it once', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event, prompt } = offer();
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);
    act(() => result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('withdraws the offer once installed, and survives a failing prompt', () => {
    const { result } = renderHook(() => useInstallPrompt());
    offer();
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.canInstall).toBe(false);
    const { prompt } = offer(
      vi.fn(() => Promise.reject(new Error('already shown'))),
    );
    act(() => result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});
