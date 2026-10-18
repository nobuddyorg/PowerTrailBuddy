// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGeolocation } from './useGeolocation';

type Success = (position: GeolocationPosition) => void;
type Failure = (error: GeolocationPositionError) => void;

const watch = {
  success: undefined as Success | undefined,
  failure: undefined as Failure | undefined,
};
const geolocation = {
  watchPosition: vi.fn((success: Success, failure: Failure) => {
    watch.success = success;
    watch.failure = failure;
    return 7;
  }),
  clearWatch: vi.fn(),
};

function provide(name: 'geolocation' | 'permissions', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

function fix(coords: Partial<GeolocationCoordinates>) {
  act(() =>
    watch.success?.({
      coords: {
        latitude: 47.5,
        longitude: 9.5,
        accuracy: 12,
        heading: null,
        speed: null,
        ...coords,
      },
    } as GeolocationPosition),
  );
}

function fail(code: number) {
  act(() =>
    watch.failure?.({
      code,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError),
  );
}

// A PermissionStatus: its state, and a `change` event when the user changes it.
function permissionStatus(state: PermissionState) {
  return Object.assign(new EventTarget(), { state });
}

beforeEach(() => {
  geolocation.watchPosition.mockClear();
  geolocation.clearWatch.mockClear();
  provide('geolocation', geolocation);
  provide('permissions', undefined);
});

afterEach(() => {
  // Unmounted first: the watch is cleared through the geolocation removed below.
  cleanup();
  Reflect.deleteProperty(navigator, 'geolocation');
  Reflect.deleteProperty(navigator, 'permissions');
});

describe('useGeolocation', () => {
  it('waits for a start before asking for the position', () => {
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.location).toEqual({ status: 'idle' });
    expect(geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it('follows the position once started, with accuracy, course and speed', () => {
    const { result, unmount } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    expect(result.current.location).toEqual({ status: 'waiting' });
    fix({ heading: 90, speed: 1.2 });
    expect(result.current.location).toEqual({
      status: 'located',
      position: { latitude: 47.5, longitude: 9.5 },
      accuracyMeters: 12,
      gpsHeading: 90,
      speed: 1.2,
    });
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
    unmount();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
  });

  it('keeps the last fix when started again', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    fix({});
    act(() => result.current.start());
    expect(result.current.location.status).toBe('located');
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('tells a refusal from a position the device cannot find', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    fail(1);
    expect(result.current.location).toEqual({ status: 'denied' });
    fail(3);
    expect(result.current.location).toEqual({ status: 'unavailable' });
  });

  it('watches again when started after a refusal, as once allowed in the site settings', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    fail(1);
    act(() => result.current.start());
    expect(result.current.location).toEqual({ status: 'waiting' });
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
    fix({});
    expect(result.current.location.status).toBe('located');
  });

  it('watches again when started after the device could not find the position', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    fail(2);
    act(() => result.current.start());
    expect(result.current.location).toEqual({ status: 'waiting' });
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
  });

  it('does not watch twice when started again while waiting', () => {
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    act(() => result.current.start());
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('starts by itself once the permission turns granted, until unmounted', async () => {
    const permission = permissionStatus('denied');
    provide('permissions', { query: () => Promise.resolve(permission) });
    const { result, unmount } = renderHook(() => useGeolocation());
    await act(() => Promise.resolve());
    permission.state = 'prompt';
    act(() => {
      permission.dispatchEvent(new Event('change'));
    });
    expect(geolocation.watchPosition).not.toHaveBeenCalled();
    permission.state = 'granted';
    act(() => {
      permission.dispatchEvent(new Event('change'));
    });
    expect(result.current.location).toEqual({ status: 'waiting' });
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      permission.dispatchEvent(new Event('change'));
    });
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('is unavailable on a device without geolocation', () => {
    Reflect.deleteProperty(navigator, 'geolocation');
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.start());
    expect(result.current.location).toEqual({ status: 'unavailable' });
  });

  it('starts by itself when the permission was granted before', async () => {
    provide('permissions', {
      query: () => Promise.resolve(permissionStatus('granted')),
    });
    const { result } = renderHook(() => useGeolocation());
    await waitFor(() =>
      expect(result.current.location).toEqual({ status: 'waiting' }),
    );
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('does not ask on a first visit, nor when the permission check fails', async () => {
    provide('permissions', {
      query: () => Promise.resolve(permissionStatus('prompt')),
    });
    const first = renderHook(() => useGeolocation());
    provide('permissions', {
      query: () => Promise.reject(new TypeError('unsupported')),
    });
    const second = renderHook(() => useGeolocation());
    await act(() => Promise.resolve());
    expect(first.result.current.location).toEqual({ status: 'idle' });
    expect(second.result.current.location).toEqual({ status: 'idle' });
  });

  it('starts nothing after unmounting before the permission answer', async () => {
    let answer: (status: EventTarget & { state: string }) => void = () => {};
    provide('permissions', {
      query: () => new Promise((resolve) => (answer = resolve)),
    });
    const { unmount } = renderHook(() => useGeolocation());
    unmount();
    answer(permissionStatus('granted'));
    await act(() => Promise.resolve());
    expect(geolocation.watchPosition).not.toHaveBeenCalled();
  });
});
