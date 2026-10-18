'use client';

import { useEffect } from 'react';

/** Keeps the screen on while active; the browser drops the lock when the page hides, so it is taken again on return. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let released = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (released) void lock.release();
          else sentinel = lock;
        })
        // Refused on low battery or without a user gesture; the walk works without it.
        .catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, [active]);
}
