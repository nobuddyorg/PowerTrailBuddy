'use client';

import { useEffect, useRef } from 'react';

import type { Geocache } from '../../lib/geocache/types';
import { bearingDegrees, distanceMeters } from '../../lib/trails/geo';
import { pickHeading, type Heading } from '../../lib/ui-logic/heading';
import { CLOSE_METERS } from '../../lib/ui-logic/walkStats';
import type { GeolocationState } from '../../useGeolocation';

export type Guide =
  | { status: 'no-position'; heading: Heading }
  | {
      status: 'guiding';
      distanceMeters: number;
      bearing: number;
      heading: Heading;
      close: boolean;
    };

const CLOSE_VIBRATION_MS = 250;

/** Distance and direction to the target from the live position and heading; buzzes once per target on arrival. */
export function useWalkGuide({
  target,
  location,
  compassHeading,
}: {
  target: Geocache | undefined;
  location: GeolocationState;
  compassHeading?: number;
}): Guide {
  const located = location.status === 'located' ? location : undefined;
  const heading = pickHeading({
    compass: compassHeading,
    gpsHeading: located?.gpsHeading,
    speed: located?.speed,
  });
  const guide: Guide =
    located && target
      ? {
          status: 'guiding',
          distanceMeters: distanceMeters(located.position, target),
          bearing: bearingDegrees(located.position, target),
          heading,
          close: distanceMeters(located.position, target) < CLOSE_METERS,
        }
      : { status: 'no-position', heading };

  const buzzedFor = useRef('');
  const close = guide.status === 'guiding' && guide.close;
  const code = target?.code ?? '';
  useEffect(() => {
    if (!close || buzzedFor.current === code) return;
    buzzedFor.current = code;
    navigator.vibrate?.(CLOSE_VIBRATION_MS);
  }, [close, code]);

  return guide;
}
