export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const POINTS: readonly CompassPoint[] = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
];
const DEGREES_PER_POINT = 360 / POINTS.length;

/** The nearest of the eight compass points to a bearing in degrees, any turn count. */
export function compassPoint(bearing: number): CompassPoint {
  const normalized = ((bearing % 360) + 360) % 360;
  return POINTS[Math.round(normalized / DEGREES_PER_POINT) % POINTS.length];
}

/** Where the target lies relative to the way the walker faces, 0..360 clockwise: 0 is straight ahead. */
export function relativeBearing(
  targetBearing: number,
  heading: number,
): number {
  return (((targetBearing - heading) % 360) + 360) % 360;
}
