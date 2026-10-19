import { describe, expect, it } from 'vitest';

import { DEGREES_PER_METER, eastwardChain } from './trails.test-support';
import { LINE_EIGENVALUE_RATIO, trailShape } from './trailShape';

/** Four points ±east and ±north of the origin: eigenvalue ratio (north / east)². */
function cross({ east, north }: { east: number; north: number }) {
  return [
    { latitude: 0, longitude: east * DEGREES_PER_METER },
    { latitude: 0, longitude: -east * DEGREES_PER_METER },
    { latitude: north * DEGREES_PER_METER, longitude: 0 },
    { latitude: -north * DEGREES_PER_METER, longitude: 0 },
  ];
}

describe('trailShape', () => {
  it('calls a chain along a road a line', () => {
    expect(
      trailShape(
        eastwardChain(
          { latitude: 52, longitude: 13 },
          { count: 20, spacingMeters: 150 },
        ),
      ),
    ).toBe('line');
  });

  it('calls a diagonal chain a line, whatever its direction', () => {
    const diagonal = Array.from({ length: 10 }, (_, index) => ({
      latitude: 40 + index * 100 * DEGREES_PER_METER,
      longitude: 3 - index * 130 * DEGREES_PER_METER,
    }));
    expect(trailShape(diagonal)).toBe('line');
  });

  it('calls a square block of caches an area', () => {
    const block = Array.from({ length: 25 }, (_, index) => ({
      latitude: 45 + Math.floor(index / 5) * 100 * DEGREES_PER_METER,
      longitude:
        -70 +
        ((index % 5) * 100 * DEGREES_PER_METER) /
          Math.cos((45 * Math.PI) / 180),
    }));
    expect(trailShape(block)).toBe('area');
  });

  it('calls an L of two equal arms an area', () => {
    const arm = Array.from(
      { length: 10 },
      (_, index) => index * 100 * DEGREES_PER_METER,
    );
    const shape = [
      ...arm.map((north) => ({ latitude: north, longitude: 0 })),
      ...arm.slice(1).map((east) => ({ latitude: 0, longitude: east })),
    ];
    expect(trailShape(shape)).toBe('area');
  });

  it('splits line from area at the documented eigenvalue ratio', () => {
    expect(LINE_EIGENVALUE_RATIO).toBe(0.1);
    expect(
      trailShape(cross({ east: 1000, north: 1000 * Math.sqrt(0.098) })),
    ).toBe('line');
    expect(
      trailShape(cross({ east: 1000, north: 1000 * Math.sqrt(0.102) })),
    ).toBe('area');
    expect(
      trailShape(cross({ east: 1000 * Math.sqrt(0.098), north: 1000 })),
    ).toBe('line');
  });

  it('calls two caches a line and a single position an area', () => {
    expect(
      trailShape(
        eastwardChain(
          { latitude: 0, longitude: 0 },
          { count: 2, spacingMeters: 200 },
        ),
      ),
    ).toBe('line');
    expect(trailShape([{ latitude: 10, longitude: 10 }])).toBe('area');
    expect(
      trailShape([
        { latitude: 10, longitude: 10 },
        { latitude: 10, longitude: 10 },
      ]),
    ).toBe('area');
  });

  it('measures shape across the antimeridian', () => {
    expect(
      trailShape(
        eastwardChain(
          { latitude: 0, longitude: 179.99 },
          { count: 10, spacingMeters: 150 },
        ),
      ),
    ).toBe('line');
  });
});
