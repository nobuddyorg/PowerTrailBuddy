export interface OrientationReading {
  /** iOS Safari's own compass heading, 0 = north, clockwise; absent elsewhere. */
  webkitCompassHeading?: number;
  /** Rotation about the vertical axis, counter-clockwise; earth-referenced only when `absolute`. */
  alpha: number | null;
  absolute: boolean;
  /** The screen's rotation from its natural orientation, so a phone held sideways still points right. */
  screenAngle: number;
}

const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;

/** The way the top of the screen faces, 0..360 clockwise from north; undefined when the event is not earth-referenced. */
export function compassHeading(
  reading: OrientationReading,
): number | undefined {
  const { webkitCompassHeading, alpha, absolute, screenAngle } = reading;
  if (Number.isFinite(webkitCompassHeading))
    return normalize(webkitCompassHeading! + screenAngle);
  if (absolute && Number.isFinite(alpha))
    return normalize(360 - alpha! + screenAngle);
  return undefined;
}

export type Heading =
  { source: 'compass' | 'gps'; degrees: number } | { source: 'none' };

// Below a brisk shuffle, GPS course is noise.
export const MOVING_METERS_PER_SECOND = 0.7;

/** The best heading at hand: the compass, else the GPS course while walking, else none. */
export function pickHeading({
  compass,
  gpsHeading,
  speed,
}: {
  compass?: number;
  gpsHeading?: number | null;
  speed?: number | null;
}): Heading {
  if (compass !== undefined) return { source: 'compass', degrees: compass };
  if (Number.isFinite(gpsHeading) && (speed ?? 0) >= MOVING_METERS_PER_SECOND) {
    return { source: 'gps', degrees: normalize(gpsHeading!) };
  }
  return { source: 'none' };
}

/** True when a new heading differs enough from the shown one to be worth a re-render. */
export function headingChanged(
  shown: number | undefined,
  next: number,
  thresholdDegrees: number,
): boolean {
  if (shown === undefined) return true;
  const difference = Math.abs(normalize(next - shown));
  return Math.min(difference, 360 - difference) >= thresholdDegrees;
}
