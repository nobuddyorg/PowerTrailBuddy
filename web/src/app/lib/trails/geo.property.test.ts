import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { bearingDegrees, distanceMeters, EARTH_RADIUS_METERS } from './geo';
import { anyCoordinates } from './trails.test-support';

describe('distanceMeters, for any points on Earth', () => {
  it('is zero from a point to itself', () => {
    fc.assert(
      fc.property(anyCoordinates, (point) => {
        expect(distanceMeters(point, point)).toBe(0);
      }),
    );
  });

  it('is symmetric', () => {
    fc.assert(
      fc.property(anyCoordinates, anyCoordinates, (a, b) => {
        expect(distanceMeters(a, b)).toBe(distanceMeters(b, a));
      }),
    );
  });

  it('never exceeds half the circumference and is never negative', () => {
    fc.assert(
      fc.property(anyCoordinates, anyCoordinates, (a, b) => {
        const distance = distanceMeters(a, b);
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(Math.PI * EARTH_RADIUS_METERS);
      }),
    );
  });

  // Within a metre: asin loses precision near antipodal points.
  it('obeys the triangle inequality', () => {
    fc.assert(
      fc.property(anyCoordinates, anyCoordinates, anyCoordinates, (a, b, c) => {
        expect(distanceMeters(a, c)).toBeLessThanOrEqual(
          distanceMeters(a, b) + distanceMeters(b, c) + 1,
        );
      }),
    );
  });
});

describe('bearingDegrees, for any points on Earth', () => {
  it('lies in [0, 360)', () => {
    fc.assert(
      fc.property(anyCoordinates, anyCoordinates, (a, b) => {
        const bearing = bearingDegrees(a, b);
        expect(bearing).toBeGreaterThanOrEqual(0);
        expect(bearing).toBeLessThan(360);
      }),
    );
  });
});
