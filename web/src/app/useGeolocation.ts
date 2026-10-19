'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Coordinates } from './lib/geocache/types';

export type GeolocationState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | {
      status: 'located';
      position: Coordinates;
      accuracyMeters: number;
      /** Course over ground, degrees clockwise from north; null when standing still or unknown. */
      gpsHeading: number | null;
      /** Metres per second; null when unknown. */
      speed: number | null;
    }
  | { status: 'denied' }
  | { status: 'unavailable' };

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 30_000,
};

const STARTABLE_STATUSES: readonly GeolocationState['status'][] = [
  'idle',
  'denied',
  'unavailable',
];

/** The device position once started; it starts by itself when the permission was granted before. */
export function useGeolocation(): {
  location: GeolocationState;
  start: () => void;
} {
  const [location, setLocation] = useState<GeolocationState>({
    status: 'idle',
  });
  // Bumped to (re)start the watch; 0 until the first start.
  const [watchGeneration, setWatchGeneration] = useState(0);
  const statusRef = useRef(location.status);
  useEffect(() => {
    statusRef.current = location.status;
  }, [location.status]);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'unavailable' });
      return;
    }
    // A refusal ends its watch, so after the user allows it in the site settings only a new watch can succeed.
    if (!STARTABLE_STATUSES.includes(statusRef.current)) return;
    statusRef.current = 'waiting';
    setLocation({ status: 'waiting' });
    setWatchGeneration((generation) => generation + 1);
  }, []);

  // Asking only when the user acts, unless the browser already says yes, so no prompt greets a first visit.
  useEffect(() => {
    let permission: PermissionStatus | undefined;
    let cancelled = false;
    const startIfGranted = () => {
      if (permission?.state === 'granted') start();
    };
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled) return;
        permission = status;
        permission.addEventListener('change', startIfGranted);
        startIfGranted();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      permission?.removeEventListener('change', startIfGranted);
    };
  }, [start]);

  useEffect(() => {
    if (watchGeneration === 0) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setLocation({
          status: 'located',
          position: { latitude: coords.latitude, longitude: coords.longitude },
          accuracyMeters: coords.accuracy,
          gpsHeading: coords.heading,
          speed: coords.speed,
        }),
      // A timeout or a lost fix keeps the watch running and the last fix shown: standing still at a cache, no new fix may come.
      (error) =>
        setLocation((current) => {
          if (error.code === error.PERMISSION_DENIED)
            return { status: 'denied' };
          return current.status === 'located'
            ? current
            : { status: 'unavailable' };
        }),
      WATCH_OPTIONS,
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [watchGeneration]);

  return { location, start };
}
