'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { compassHeading, headingChanged } from './lib/ui-logic/heading';

// iOS Safari's additions to the event and its constructor.
interface CompassEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}
interface PermissionedOrientation {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// Re-rendering the arrow for every sensor tick costs more than a two-degree wobble is worth.
const SHOWN_CHANGE_DEGREES = 2;

function orientationApi(): PermissionedOrientation | undefined {
  return typeof DeviceOrientationEvent === 'undefined'
    ? undefined
    : (DeviceOrientationEvent as unknown as PermissionedOrientation);
}

/** The compass heading while active; on iOS only after `requestPermission`, which must run in a tap. */
export function useCompass(active: boolean): {
  heading?: number;
  needsPermission: boolean;
  requestPermission: () => void;
} {
  const [heading, setHeading] = useState<number>();
  const [needsPermission, setNeedsPermission] = useState(
    () => typeof orientationApi()?.requestPermission === 'function',
  );
  const shownRef = useRef<number>(undefined);

  useEffect(() => {
    if (!active || needsPermission || orientationApi() === undefined) return;
    const eventName =
      'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : 'deviceorientation';
    const onOrientation = (event: Event) => {
      const { webkitCompassHeading, alpha, absolute } = event as CompassEvent;
      const next = compassHeading({
        webkitCompassHeading,
        alpha,
        absolute: absolute || eventName === 'deviceorientationabsolute',
        screenAngle: window.screen.orientation?.angle ?? 0,
      });
      if (
        next === undefined ||
        !headingChanged(shownRef.current, next, SHOWN_CHANGE_DEGREES)
      )
        return;
      shownRef.current = next;
      setHeading(next);
    };
    window.addEventListener(eventName, onOrientation);
    return () => window.removeEventListener(eventName, onOrientation);
  }, [active, needsPermission]);

  const requestPermission = useCallback(() => {
    orientationApi()
      ?.requestPermission?.()
      .then((answer) => {
        if (answer === 'granted') setNeedsPermission(false);
      })
      .catch(() => {});
  }, []);

  return {
    heading: active ? heading : undefined,
    needsPermission,
    requestPermission,
  };
}
