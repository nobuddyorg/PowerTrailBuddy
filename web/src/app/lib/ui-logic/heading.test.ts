import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  compassHeading,
  headingChanged,
  MOVING_METERS_PER_SECOND,
  pickHeading,
} from './heading';

const reading = (overrides: Partial<Parameters<typeof compassHeading>[0]>) => ({
  alpha: null,
  absolute: false,
  screenAngle: 0,
  ...overrides,
});

describe('compassHeading', () => {
  it("takes iOS's compass heading as it is, turned with the screen", () => {
    expect(compassHeading(reading({ webkitCompassHeading: 42 }))).toBe(42);
    expect(
      compassHeading(reading({ webkitCompassHeading: 300, screenAngle: 90 })),
    ).toBe(30);
  });

  it('turns an absolute alpha, counted counter-clockwise, into a clockwise heading', () => {
    expect(compassHeading(reading({ alpha: 90, absolute: true }))).toBe(270);
    expect(compassHeading(reading({ alpha: 0, absolute: true }))).toBe(0);
    expect(
      compassHeading(reading({ alpha: 10, absolute: true, screenAngle: 270 })),
    ).toBe(260);
  });

  it('has no heading from a relative alpha or none at all', () => {
    expect(
      compassHeading(reading({ alpha: 90, absolute: false })),
    ).toBeUndefined();
    expect(
      compassHeading(reading({ alpha: null, absolute: true })),
    ).toBeUndefined();
    expect(
      compassHeading(
        reading({
          webkitCompassHeading: Number.NaN,
          alpha: 20,
          absolute: true,
        }),
      ),
    ).toBe(340);
  });

  it('always lies in 0..360', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.constantFrom(0, 90, 180, 270, -90),
        (alpha, screenAngle) => {
          const heading = compassHeading(
            reading({ alpha, absolute: true, screenAngle }),
          )!;
          expect(heading).toBeGreaterThanOrEqual(0);
          expect(heading).toBeLessThan(360);
        },
      ),
    );
  });
});

describe('pickHeading', () => {
  it('prefers the compass', () => {
    expect(pickHeading({ compass: 12, gpsHeading: 200, speed: 3 })).toEqual({
      source: 'compass',
      degrees: 12,
    });
  });

  it('uses the GPS course while walking', () => {
    expect(
      pickHeading({ gpsHeading: 370, speed: MOVING_METERS_PER_SECOND }),
    ).toEqual({ source: 'gps', degrees: 10 });
  });

  it('has none standing still, without a course, or without a speed', () => {
    expect(
      pickHeading({ gpsHeading: 90, speed: MOVING_METERS_PER_SECOND - 0.01 }),
    ).toEqual({ source: 'none' });
    expect(pickHeading({ gpsHeading: null, speed: 2 })).toEqual({
      source: 'none',
    });
    expect(pickHeading({ gpsHeading: 90, speed: null })).toEqual({
      source: 'none',
    });
    expect(pickHeading({})).toEqual({ source: 'none' });
  });
});

describe('headingChanged', () => {
  it('always shows a first heading', () => {
    expect(headingChanged(undefined, 0, 2)).toBe(true);
  });

  it('ignores a wobble under the threshold, across north too', () => {
    expect(headingChanged(100, 101.9, 2)).toBe(false);
    expect(headingChanged(100, 102, 2)).toBe(true);
    expect(headingChanged(359, 0.5, 2)).toBe(false);
    expect(headingChanged(1, 358, 2)).toBe(true);
    expect(headingChanged(102, 100, 2)).toBe(true);
    expect(headingChanged(1, 359.5, 2)).toBe(false);
  });
});
