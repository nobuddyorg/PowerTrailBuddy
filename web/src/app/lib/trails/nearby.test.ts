import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { distanceMeters } from './geo';
import { distanceToTrail, nearestEnd } from './nearby';
import {
  anyCoordinates,
  DEGREES_PER_METER,
  makeCache,
} from './trails.test-support';
import type { Trail } from './types';

function trailThrough(
  points: readonly { latitude: number; longitude: number }[],
): Trail {
  return {
    id: 'GCN0-3',
    caches: points.map((point, index) =>
      makeCache({ code: `GCN${index}`, ...point }),
    ),
    pathMeters: 0,
    returnMeters: 0,
    walkMeters: 0,
    durationMinutes: 0,
    cachesPerHour: 0,
    shape: 'line',
    center: { latitude: 0, longitude: 0 },
  };
}

// Three caches 100 m apart, due north of the equator.
const meters = (north: number) => ({
  latitude: north * DEGREES_PER_METER,
  longitude: 0,
});
const trail = trailThrough([meters(0), meters(100), meters(200)]);

describe('nearestEnd', () => {
  it('picks the first cache when it is closer', () => {
    const end = nearestEnd(trail, meters(-50));
    expect(end.code).toBe('GCN0');
    expect(end.meters).toBeCloseTo(50, 6);
  });

  it('picks the last cache when it is closer', () => {
    const end = nearestEnd(trail, meters(260));
    expect(end.code).toBe('GCN2');
    expect(end.meters).toBeCloseTo(60, 6);
  });

  it('never picks a cache in the middle, however close', () => {
    expect(nearestEnd(trail, meters(110)).code).toBe('GCN2');
    expect(nearestEnd(trail, meters(90)).code).toBe('GCN0');
  });

  it('picks the first cache when both ends are equally far', () => {
    const symmetric = trailThrough([
      { latitude: 0, longitude: -0.001 },
      { latitude: 0.01, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
    ]);
    expect(nearestEnd(symmetric, { latitude: 0, longitude: 0 }).code).toBe(
      'GCN0',
    );
  });

  it('measures the distance to the end it picks, which is never farther than the other end', () => {
    fc.assert(
      fc.property(
        fc.array(anyCoordinates, { minLength: 1, maxLength: 6 }),
        anyCoordinates,
        (points, position) => {
          const caches = trailThrough(points).caches;
          const end = nearestEnd(trailThrough(points), position);
          const picked = caches.find((cache) => cache.code === end.code);
          expect([caches[0].code, caches[caches.length - 1].code]).toContain(
            end.code,
          );
          expect(end.meters).toBe(
            distanceMeters(position, picked ?? caches[0]),
          );
          expect(end.meters).toBeLessThanOrEqual(
            distanceMeters(position, caches[0]),
          );
          expect(end.meters).toBeLessThanOrEqual(
            distanceMeters(position, caches[caches.length - 1]),
          );
        },
      ),
    );
  });
});

describe('distanceToTrail', () => {
  it('measures to the nearest cache, wherever it is in the walking order', () => {
    expect(distanceToTrail(trail, meters(110))).toBeCloseTo(10, 6);
    expect(distanceToTrail(trail, meters(-30))).toBeCloseTo(30, 6);
    expect(distanceToTrail(trail, meters(230))).toBeCloseTo(30, 6);
  });

  it('is zero standing on a cache', () => {
    expect(distanceToTrail(trail, meters(100))).toBe(0);
  });

  it('is the smallest distance to any cache', () => {
    fc.assert(
      fc.property(
        fc.array(anyCoordinates, { minLength: 1, maxLength: 6 }),
        anyCoordinates,
        (points, position) => {
          const distances = points.map((point) =>
            distanceMeters(position, point),
          );
          expect(distanceToTrail(trailThrough(points), position)).toBe(
            Math.min(...distances),
          );
        },
      ),
    );
  });
});
