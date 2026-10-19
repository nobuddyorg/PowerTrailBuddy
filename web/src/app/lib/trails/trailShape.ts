import type { Coordinates } from '../geocache/types';
import { projectToPlane } from './projection';

/** Eigenvalue ratio below which a trail is a line: spread across its axis under √0.1 ≈ a third of that along it. */
export const LINE_EIGENVALUE_RATIO = 0.1;

/** 'line' for an elongated set (a chain along a road), 'area' for a compact one; non-empty input. */
export function trailShape(points: readonly Coordinates[]): 'line' | 'area' {
  // The plane is centered on the points' mean, so these sums are n times the variances along both axes and both diagonals.
  const plane = projectToPlane(points);
  let xx = 0;
  let yy = 0;
  let rising = 0;
  let falling = 0;
  for (const { x, y } of plane) {
    xx += x * x;
    yy += y * y;
    rising += (x + y) ** 2 / 2;
    falling += (x - y) ** 2 / 2;
  }
  // The covariance is (rising - falling) / 2, so the eigenvalues sit half the axes' and diagonals' differences around the mean.
  const mean = (xx + yy) / 2;
  const spread = Math.hypot(xx - yy, rising - falling) / 2;
  const larger = mean + spread;
  const smaller = mean - spread;
  return smaller < LINE_EIGENVALUE_RATIO * larger ? 'line' : 'area';
}
