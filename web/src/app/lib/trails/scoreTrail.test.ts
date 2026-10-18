import { describe, expect, it } from 'vitest';

import { EARTH_RADIUS_METERS } from './geo';
import { scoreTrail } from './scoreTrail';
import { makeCache } from './trails.test-support';
import { DEFAULT_TRAIL_SETTINGS } from './types';

const HUNDREDTH_DEGREE_METERS = (Math.PI * EARTH_RADIUS_METERS) / 18_000;

describe('scoreTrail', () => {
  const caches = [
    makeCache({ code: 'GCB', latitude: 0, longitude: 0 }),
    makeCache({ code: 'GCA', latitude: 0, longitude: 0.01 }),
    makeCache({ code: 'GCC', latitude: 0, longitude: 0.02 }),
  ];
  const trail = scoreTrail(caches, {
    ...DEFAULT_TRAIL_SETTINGS,
    detourFactor: 1.5,
    walkingSpeedKmh: 5,
    minutesPerCache: 4,
  });

  it('measures the path along the order and the straight way back', () => {
    expect(trail.pathMeters).toBeCloseTo(2 * HUNDREDTH_DEGREE_METERS, 6);
    expect(trail.returnMeters).toBeCloseTo(2 * HUNDREDTH_DEGREE_METERS, 6);
    expect(trail.walkMeters).toBeCloseTo(4 * HUNDREDTH_DEGREE_METERS * 1.5, 6);
  });

  it('estimates the time from walking speed and a fixed time per cache', () => {
    const walkingMinutes = ((4 * HUNDREDTH_DEGREE_METERS * 1.5) / 5000) * 60;
    expect(trail.durationMinutes).toBeCloseTo(walkingMinutes + 3 * 4, 6);
    expect(trail.cachesPerHour).toBeCloseTo(
      (3 / (walkingMinutes + 12)) * 60,
      6,
    );
  });

  it('names the trail after its smallest code and size, and keeps the walking order', () => {
    expect(trail.id).toBe('GCA-3');
    expect(trail.caches.map((cache) => cache.code)).toEqual([
      'GCB',
      'GCA',
      'GCC',
    ]);
    expect(trail.caches).not.toBe(caches);
  });

  it('gives the same id walked the other way round', () => {
    expect(scoreTrail([...caches].reverse(), DEFAULT_TRAIL_SETTINGS).id).toBe(
      'GCA-3',
    );
    expect(scoreTrail([caches[2], caches[0]], DEFAULT_TRAIL_SETTINGS).id).toBe(
      'GCB-2',
    );
  });

  it('finds the center and the shape', () => {
    expect(trail.center.latitude).toBe(0);
    expect(trail.center.longitude).toBeCloseTo(0.01, 12);
    expect(trail.shape).toBe('line');
  });

  it('scores a single cache with no walk and only its own time', () => {
    const single = scoreTrail(
      [makeCache({ code: 'GCONE', latitude: 5, longitude: 5 })],
      DEFAULT_TRAIL_SETTINGS,
    );
    expect(single).toMatchObject({
      id: 'GCONE-1',
      pathMeters: 0,
      returnMeters: 0,
      walkMeters: 0,
      durationMinutes: 3,
      cachesPerHour: 20,
      shape: 'area',
      center: { latitude: 5, longitude: 5 },
    });
  });
});
