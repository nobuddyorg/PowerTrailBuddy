// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCompass } from './useCompass';

type Permission = () => Promise<'granted' | 'denied'>;

function installOrientation({
  requestPermission,
  absoluteEvent = false,
}: { requestPermission?: Permission; absoluteEvent?: boolean } = {}) {
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(
      function DeviceOrientationEvent() {},
      requestPermission ? { requestPermission } : {},
    ),
  );
  if (absoluteEvent) {
    Object.defineProperty(window, 'ondeviceorientationabsolute', {
      value: null,
      configurable: true,
    });
  }
}

function turn(
  name: string,
  reading: {
    alpha?: number | null;
    absolute?: boolean;
    webkitCompassHeading?: number;
  },
) {
  act(() => {
    window.dispatchEvent(
      Object.assign(new Event(name), {
        alpha: null,
        absolute: false,
        ...reading,
      }),
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'ondeviceorientationabsolute');
  Reflect.deleteProperty(window.screen, 'orientation');
});

describe('useCompass', () => {
  it('has no heading on a device without orientation events', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    const { result } = renderHook(() => useCompass(true));
    expect(result.current.heading).toBeUndefined();
    expect(result.current.needsPermission).toBe(false);
    act(() => result.current.requestPermission());
    expect(result.current.needsPermission).toBe(false);
  });

  it('reads the earth-referenced event where the browser has one', () => {
    installOrientation({ absoluteEvent: true });
    const { result } = renderHook(() => useCompass(true));
    turn('deviceorientationabsolute', { alpha: 90 });
    expect(result.current.heading).toBe(270);
  });

  it('turns the heading with a phone held sideways', () => {
    installOrientation({ absoluteEvent: true });
    Object.defineProperty(window.screen, 'orientation', {
      value: { angle: 90 },
      configurable: true,
    });
    const { result } = renderHook(() => useCompass(true));
    turn('deviceorientationabsolute', { alpha: 90 });
    expect(result.current.heading).toBe(0);
  });

  it('uses Safari’s compass heading, and ignores a reading not tied to north', () => {
    installOrientation();
    const { result } = renderHook(() => useCompass(true));
    turn('deviceorientation', { alpha: 40 });
    expect(result.current.heading).toBeUndefined();
    turn('deviceorientation', { webkitCompassHeading: 123 });
    expect(result.current.heading).toBe(123);
    turn('deviceorientation', { alpha: 300, absolute: true });
    expect(result.current.heading).toBe(60);
  });

  it('skips a wobble of under two degrees', () => {
    installOrientation();
    const { result } = renderHook(() => useCompass(true));
    turn('deviceorientation', { webkitCompassHeading: 100 });
    turn('deviceorientation', { webkitCompassHeading: 101 });
    expect(result.current.heading).toBe(100);
    turn('deviceorientation', { webkitCompassHeading: 102 });
    expect(result.current.heading).toBe(102);
  });

  it('shows no heading and stops listening while inactive', () => {
    installOrientation();
    const { result, rerender } = renderHook(
      ({ active }) => useCompass(active),
      {
        initialProps: { active: true },
      },
    );
    turn('deviceorientation', { webkitCompassHeading: 50 });
    rerender({ active: false });
    expect(result.current.heading).toBeUndefined();
    turn('deviceorientation', { webkitCompassHeading: 200 });
    rerender({ active: true });
    expect(result.current.heading).toBe(50);
  });

  it('on iOS waits for the permission a tap asks for', async () => {
    installOrientation({ requestPermission: () => Promise.resolve('granted') });
    const { result } = renderHook(() => useCompass(true));
    expect(result.current.needsPermission).toBe(true);
    turn('deviceorientation', { webkitCompassHeading: 10 });
    expect(result.current.heading).toBeUndefined();
    await act(async () => result.current.requestPermission());
    expect(result.current.needsPermission).toBe(false);
    turn('deviceorientation', { webkitCompassHeading: 10 });
    expect(result.current.heading).toBe(10);
  });

  it('keeps asking when the permission is refused or the request fails', async () => {
    const answers: Permission[] = [
      () => Promise.resolve('denied'),
      () => Promise.reject(new Error('no gesture')),
    ];
    for (const requestPermission of answers) {
      installOrientation({ requestPermission });
      const { result, unmount } = renderHook(() => useCompass(true));
      await act(async () => result.current.requestPermission());
      expect(result.current.needsPermission).toBe(true);
      unmount();
    }
  });
});
