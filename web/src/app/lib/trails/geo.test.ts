import { describe, expect, it } from 'vitest';

import {
  bearingDegrees,
  distanceMeters,
  EARTH_RADIUS_METERS,
  pathMeters,
  toRadians,
} from './geo';

const ONE_DEGREE_METERS = (Math.PI * EARTH_RADIUS_METERS) / 180;

describe('distanceMeters', () => {
  it('is zero between a point and itself', () => {
    expect(
      distanceMeters(
        { latitude: 48.1, longitude: 11.5 },
        { latitude: 48.1, longitude: 11.5 },
      ),
    ).toBe(0);
  });

  it('measures one degree of latitude as one degree of the 6371008.8 m sphere', () => {
    expect(
      distanceMeters(
        { latitude: 10, longitude: 20 },
        { latitude: 11, longitude: 20 },
      ),
    ).toBeCloseTo(ONE_DEGREE_METERS, 6);
  });

  it('shrinks a degree of longitude by the cosine of the latitude', () => {
    expect(
      distanceMeters(
        { latitude: 60, longitude: 5 },
        { latitude: 60, longitude: 5.01 },
      ),
    ).toBeCloseTo(ONE_DEGREE_METERS * 0.01 * 0.5, 1);
  });

  it('measures a known diagonal: 1° north and 1° east of the equator', () => {
    // Spherical law of cosines: cos c = cos 1° · cos 1°.
    const expected =
      EARTH_RADIUS_METERS * Math.acos(Math.cos(toRadians(1)) ** 2);
    expect(
      distanceMeters(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      ),
    ).toBeCloseTo(expected, 3);
  });

  it('measures the short way across the antimeridian', () => {
    expect(
      distanceMeters(
        { latitude: 0, longitude: 179.9995 },
        { latitude: 0, longitude: -179.9995 },
      ),
    ).toBeCloseTo(ONE_DEGREE_METERS * 0.001, 3);
  });

  it('stays finite for antipodal points whose rounding overshoots', () => {
    expect(
      distanceMeters(
        { latitude: 0.74, longitude: -180 },
        { latitude: -0.74, longitude: 0 },
      ),
    ).toBe(Math.PI * EARTH_RADIUS_METERS);
  });
});

describe('bearingDegrees', () => {
  const origin = { latitude: 0, longitude: 0 };

  it.each([
    ['north', { latitude: 1, longitude: 0 }, 0],
    ['east', { latitude: 0, longitude: 1 }, 90],
    ['south', { latitude: -1, longitude: 0 }, 180],
    ['west', { latitude: 0, longitude: -1 }, 270],
    ['north-east', { latitude: 1, longitude: 1 }, 44.995636],
    ['south-west', { latitude: -1, longitude: -1 }, 224.995636],
  ])('points %s', (_, target, expected) => {
    expect(bearingDegrees(origin, target)).toBeCloseTo(expected, 4);
  });

  it('points east across the antimeridian', () => {
    expect(
      bearingDegrees(
        { latitude: 0, longitude: 179.9 },
        { latitude: 0, longitude: -179.9 },
      ),
    ).toBeCloseTo(90, 6);
  });

  it('accounts for the start latitude on a great circle', () => {
    // Expected values from tangent-plane vector projection, an independent derivation.
    expect(
      bearingDegrees(
        { latitude: 60, longitude: 0 },
        { latitude: 60, longitude: 10 },
      ),
    ).toBeCloseTo(85.667126, 5);
    expect(
      bearingDegrees(
        { latitude: 30, longitude: 10 },
        { latitude: 20, longitude: -5 },
      ),
    ).toBeCloseTo(237.050417, 5);
  });

  it('accounts for the target latitude', () => {
    expect(
      bearingDegrees(
        { latitude: 0, longitude: 0 },
        { latitude: -60, longitude: 10 },
      ),
    ).toBeCloseTo(174.274895, 5);
  });
});

describe('pathMeters', () => {
  it('is zero for no point and for one point', () => {
    expect(pathMeters([])).toBe(0);
    expect(pathMeters([{ latitude: 1, longitude: 1 }])).toBe(0);
  });

  it('adds the legs in order', () => {
    const points = [
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
      { latitude: 1, longitude: 0 },
      { latitude: 0, longitude: 0 },
    ];
    expect(pathMeters(points)).toBeCloseTo(2 * ONE_DEGREE_METERS, 6);
  });
});
