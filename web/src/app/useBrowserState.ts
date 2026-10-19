'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** False while the browser reports no network; the prerender assumes online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** Whether a media query matches now; the prerender assumes it does not. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const subscribeNever = () => () => {};

// iPadOS reports itself as a Mac; a Mac opens Apple's Maps links too, so the two need no telling apart.
const APPLE_DEVICE = /iPhone|iPad|iPod|Macintosh/;

/** Whether this is an Apple device, which opens maps.apple.com links but nothing for `geo:`; the prerender assumes not. */
export function useApplePlatform(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => APPLE_DEVICE.test(navigator.userAgent),
    () => false,
  );
}

/** The current time in milliseconds, refreshed every `intervalMs` while active. */
export function useNow(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, active]);
  return now;
}
