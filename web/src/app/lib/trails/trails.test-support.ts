import fc from 'fast-check';

import type { Coordinates, Geocache } from '../geocache/types';
import { EARTH_RADIUS_METERS } from './geo';

/** One metre north or east at the equator, in degrees. */
export const DEGREES_PER_METER = 180 / (Math.PI * EARTH_RADIUS_METERS);

/** A synthetic cache that passes every default filter; the code and position are invented. */
export function makeCache(overrides: Partial<Geocache> = {}): Geocache {
  return {
    code: 'GCTEST1',
    name: 'Synthetic cache',
    type: 'traditional',
    difficulty: 1.5,
    terrain: 1.5,
    container: 'Micro',
    available: true,
    archived: false,
    found: false,
    placedBy: '',
    hint: '',
    recentLogs: [],
    latitude: 0,
    longitude: 0,
    ...overrides,
  };
}

/** count points due east of start, spacingMeters apart along the parallel. */
export function eastwardChain(
  start: Coordinates,
  { count, spacingMeters }: { count: number; spacingMeters: number },
): Coordinates[] {
  const degreesEast =
    (spacingMeters * DEGREES_PER_METER) /
    Math.cos((start.latitude * Math.PI) / 180);
  return Array.from({ length: count }, (_, index) => ({
    latitude: start.latitude,
    longitude: wrapLongitude(start.longitude + index * degreesEast),
  }));
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

export const anyCoordinates: fc.Arbitrary<Coordinates> = fc.record({
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
});

// Integers spread more evenly than doubles, which favour 0 and ±1 and so pile points up.
const unitOffset = fc
  .integer({ min: -1000, max: 1000 })
  .map((thousandths) => thousandths / 1000);

/** Points within roughly spanMeters of an anchor anywhere on Earth, including the poles and ±180°. */
export function pointsNear({
  minLength,
  maxLength,
  spanMeters,
}: {
  minLength: number;
  maxLength: number;
  spanMeters: number;
}): fc.Arbitrary<Coordinates[]> {
  const spanDegrees = spanMeters * DEGREES_PER_METER;
  return fc
    .tuple(
      fc.oneof(
        anyCoordinates,
        fc.constantFrom<Coordinates>(
          { latitude: 0, longitude: 179.999 },
          { latitude: 48.2, longitude: -180 },
          { latitude: 89.99, longitude: 0 },
          { latitude: -89.995, longitude: 120 },
          { latitude: 70, longitude: 179.9 },
        ),
      ),
      fc.array(
        fc.record({
          north: unitOffset,
          east: unitOffset,
        }),
        { minLength, maxLength, size: 'max' },
      ),
    )
    .map(([anchor, offsets]) =>
      offsets.map(({ north, east }) => ({
        latitude: Math.max(
          -90,
          Math.min(90, anchor.latitude + north * spanDegrees),
        ),
        longitude: wrapLongitude(
          anchor.longitude +
            (east * spanDegrees) /
              Math.max(0.01, Math.cos((anchor.latitude * Math.PI) / 180)),
        ),
      })),
    );
}

/** Deterministic pseudo-random numbers in [0, 1). */
export function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) >>> 0;
    return state / 2 ** 32;
  };
}

export function shuffledWithSeed<T>(items: readonly T[], seed: number): T[] {
  const random = randomSequence(seed);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** count caches 160 m apart on a random meandering line in a 300 km square near 47°N 8°E, like a roadside trail. */
export function meanderingTrail(
  prefix: string,
  { count, random }: { count: number; random: () => number },
): Geocache[] {
  let north = random() * 300_000;
  let east = random() * 300_000;
  let heading = random() * 2 * Math.PI;
  const metersPerDegreeEast =
    Math.cos((47 * Math.PI) / 180) / DEGREES_PER_METER;
  return Array.from({ length: count }, (_, index) => {
    heading += (random() - 0.5) * 0.8;
    north += Math.cos(heading) * 160;
    east += Math.sin(heading) * 160;
    return makeCache({
      code: `${prefix}${index}`,
      latitude: 47 + north * DEGREES_PER_METER,
      longitude: 8 + east / metersPerDegreeEast,
    });
  });
}
