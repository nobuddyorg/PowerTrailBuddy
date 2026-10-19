import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { distanceMeters } from './geo';
import { centerOf, longitudeOffset, projectToPlane } from './projection';
import { eastwardChain, pointsNear } from './trails.test-support';

describe('longitudeOffset', () => {
  it.each([
    [10, 20, 10],
    [20, 10, -10],
    [179, -179, 2],
    [-179, 179, -2],
    [0, 180, -180],
    [0, -180, -180],
    [-170, 175, -15],
    [0, 540, -180],
    [0, -190, 170],
  ])('from %d to %d is %d', (from, to, expected) => {
    expect(longitudeOffset(from, to)).toBe(expected);
  });

  it('always lies in [-180, 180)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -720, max: 720, noNaN: true }),
        fc.double({ min: -720, max: 720, noNaN: true }),
        (from, to) => {
          const offset = longitudeOffset(from, to);
          expect(offset).toBeGreaterThanOrEqual(-180);
          expect(offset).toBeLessThan(180);
        },
      ),
    );
  });
});

describe('centerOf', () => {
  it('averages latitude and longitude', () => {
    expect(
      centerOf([
        { latitude: 10, longitude: 20 },
        { latitude: 20, longitude: 40 },
        { latitude: 30, longitude: 30 },
      ]),
    ).toEqual({ latitude: 20, longitude: 30 });
  });

  it('averages across the antimeridian instead of landing on the far side of the Earth', () => {
    const center = centerOf([
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -177 },
    ]);
    expect(center.latitude).toBe(0);
    expect(center.longitude).toBeCloseTo(-179, 9);
  });

  it('keeps the center inside [-180, 180) when the mean crosses the antimeridian eastward', () => {
    expect(
      centerOf([
        { latitude: 0, longitude: 179.5 },
        { latitude: 0, longitude: -178.5 },
        { latitude: 0, longitude: -178.5 },
      ]).longitude,
    ).toBeCloseTo(-179.1666667, 6);
  });
});

describe('projectToPlane', () => {
  it('puts the center at the origin with x east and y north', () => {
    const [west, east, north] = projectToPlane([
      { latitude: 0, longitude: -0.001 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0.003, longitude: 0 },
    ]);
    expect(west.x).toBeLessThan(0);
    expect(east.x).toBeGreaterThan(0);
    expect(east.x + west.x).toBeCloseTo(0, 6);
    expect(north.y).toBeGreaterThan(0);
    expect(west.y).toBeCloseTo(east.y, 9);
    expect(north.y - east.y).toBeCloseTo(
      distanceMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 0.003, longitude: 0 },
      ),
      6,
    );
  });

  it('scales east by the cosine of the center latitude', () => {
    const chain = eastwardChain(
      { latitude: 60, longitude: 179.999 },
      { count: 2, spacingMeters: 200 },
    );
    const [first, second] = projectToPlane(chain);
    expect(second.x - first.x).toBeCloseTo(200, 2);
  });

  it('keeps plane distances within 0.5% of the sphere for points a few kilometers apart', () => {
    fc.assert(
      fc.property(
        pointsNear({ minLength: 2, maxLength: 6, spanMeters: 3000 }),
        (points) => {
          fc.pre(points.every((point) => Math.abs(point.latitude) < 80));
          const plane = projectToPlane(points);
          const sphere = distanceMeters(points[0], points[1]);
          const flat = Math.hypot(
            plane[0].x - plane[1].x,
            plane[0].y - plane[1].y,
          );
          expect(Math.abs(flat - sphere)).toBeLessThanOrEqual(
            0.005 * sphere + 1e-6,
          );
        },
      ),
    );
  });
});
