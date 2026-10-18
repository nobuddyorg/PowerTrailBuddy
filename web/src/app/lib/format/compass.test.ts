import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { compassPoint, relativeBearing } from './compass';

describe('compassPoint', () => {
  it.each([
    [0, 'N'],
    [22.4, 'N'],
    [22.5, 'NE'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
    [337.4, 'NW'],
    [337.5, 'N'],
    [359.9, 'N'],
    [360, 'N'],
    [-90, 'W'],
    [-45, 'NW'],
    [450, 'E'],
    [-720, 'N'],
  ])('reads a bearing of %s° as %s', (bearing, expected) => {
    expect(compassPoint(bearing)).toBe(expected);
  });

  it('gives the same point for a bearing a whole number of turns away', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3599 }),
        fc.integer({ min: -5, max: 5 }),
        (tenths, turns) => {
          const bearing = tenths / 10;
          expect(compassPoint(bearing + turns * 360)).toBe(
            compassPoint(bearing),
          );
        },
      ),
    );
  });
});

describe('relativeBearing', () => {
  it.each([
    [90, 0, 90],
    [90, 90, 0],
    [10, 350, 20],
    [350, 10, 340],
    [0, 180, 180],
    [720, -90, 90],
  ])(
    'a target at %s° seen facing %s° lies at %s°',
    (target, heading, expected) => {
      expect(relativeBearing(target, heading)).toBe(expected);
    },
  );

  it('turning by the relative bearing faces the target', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -720, max: 720 }),
        fc.integer({ min: -720, max: 720 }),
        (target, heading) => {
          const relative = relativeBearing(target, heading);
          expect(relative).toBeGreaterThanOrEqual(0);
          expect(relative).toBeLessThan(360);
          expect((((heading + relative - target) % 360) + 360) % 360).toBe(0);
        },
      ),
    );
  });
});
