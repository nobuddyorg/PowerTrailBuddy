import { describe, expect, it } from 'vitest';

import { syntheticCache } from './gpx.test-support';
import { namesParkingArea, withParking, type ParkingArea } from './parking';

describe('namesParkingArea', () => {
  const texts: [string, boolean][] = [
    ['Parking Area', true],
    ['parking area', true],
    [' PARKING AREA ', true],
    ['Waypoint|Parking Area', true],
    ['Waypoint|Reference Point', false],
    ['Waypoint|Parking Areas', false],
    ['No Parking Area', false],
    ['Parking Area 2', false],
    ['Parking', false],
    ['Geocache', false],
    ['', false],
  ];
  for (const [text, expected] of texts) {
    it(`reads ${JSON.stringify(text)} as ${expected ? 'a parking area' : 'something else'}`, () => {
      expect(namesParkingArea(text)).toBe(expected);
    });
  }
});

describe('withParking', () => {
  const cache = syntheticCache(1, {
    code: 'GC0ABC',
    latitude: 10,
    longitude: 20,
  });
  const area = (
    name: string,
    latitude: number,
    longitude = 20,
  ): ParkingArea => ({
    name,
    latitude,
    longitude,
  });

  it('gives a cache the parking area named after its code', () => {
    expect(withParking([cache], [area('PK0ABC', 10.002)])).toEqual([
      { ...cache, parking: { latitude: 10.002, longitude: 20 } },
    ]);
  });

  it('matches any two-letter prefix, comparing only the rest of the name', () => {
    const [parked] = withParking([cache], [area('XY0ABC', 10.002)]);
    expect(parked.parking).toEqual({ latitude: 10.002, longitude: 20 });
  });

  it('leaves a cache without parking when no area carries its code', () => {
    expect(
      withParking([cache], [area('PK0ABD', 10.002), area('PK0AB', 10.003)]),
    ).toEqual([cache]);
  });

  it('picks the nearest of several parking areas', () => {
    const areas = [
      area('PK0ABC', 10.03),
      area('PK0ABC', 9.999),
      area('PK0ABC', 10.002),
      area('PK0ABC', 10.02),
    ];
    const [parked] = withParking([cache], areas);
    expect(parked.parking).toEqual({ latitude: 9.999, longitude: 20 });
  });

  it('picks the first of two equally near parking areas', () => {
    const areas = [area('PK0ABC', 10, 20.001), area('PK0ABC', 10, 19.999)];
    const [parked] = withParking([cache], areas);
    expect(parked.parking).toEqual({ latitude: 10, longitude: 20.001 });
  });

  it('replaces the parking a cache already had', () => {
    const stale = { ...cache, parking: { latitude: 1, longitude: 1 } };
    expect(withParking([stale], [area('PK0ABC', 10.002)])[0].parking).toEqual({
      latitude: 10.002,
      longitude: 20,
    });
    expect(withParking([stale], [])).toEqual([cache]);
  });

  it('ignores a parking area whose name is only a prefix', () => {
    const short = syntheticCache(2, { code: 'GC' });
    expect(withParking([short], [area('PK', 10)])).toEqual([short]);
  });

  it('keeps every cache, in order, without changing the ones given', () => {
    const other = syntheticCache(2, { code: 'GC0XYZ' });
    const result = withParking([cache, other], [area('PK0XYZ', 10)]);
    expect(result.map((each) => each.code)).toEqual(['GC0ABC', 'GC0XYZ']);
    expect(result[1].parking).toEqual({ latitude: 10, longitude: 20 });
    expect(other.parking).toBeUndefined();
  });
});
