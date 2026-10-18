'use client';

import { useCallback, useEffect, useState } from 'react';

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

/** The device position once started; it starts by itself when the permission was granted before. */
export function useGeolocation(): {
  location: GeolocationState;
  start: () => void;
} {
  const [location, setLocation] = useState<GeolocationState>({
    status: 'idle',
  });
  const [wanted, setWanted] = useState(false);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'unavailable' });
      return;
    }
    setLocation((current) =>
      current.status === 'idle' ? { status: 'waiting' } : current,
    );
    setWanted(true);
  }, []);

  // Asking only when the user acts, unless the browser already says yes, so no prompt greets a first visit.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [start]);

  useEffect(() => {
    if (!wanted) return;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setLocation({
          status: 'located',
          position: { latitude: coords.latitude, longitude: coords.longitude },
          accuracyMeters: coords.accuracy,
          gpsHeading: coords.heading,
          speed: coords.speed,
        }),
      // A timeout or a lost fix keeps the watch running; the next fix replaces this state.
      (error) =>
        setLocation({
          status:
            error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        }),
      WATCH_OPTIONS,
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [wanted]);

  return { location, start };
}
