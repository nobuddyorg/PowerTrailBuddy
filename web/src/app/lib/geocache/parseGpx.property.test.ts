// @vitest-environment jsdom
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildGpx,
  gpxOf,
  LOG_TEXT,
  syntheticCache,
  TYPE_TEXT,
  type GpxFlavour,
  type WaypointSpec,
} from './gpx.test-support';
import { GpxParseError, parseGpx, type ParsedGpx } from './parseGpx';
import type { CacheType, Geocache, RecentLog, RecentLogType } from './types';

// Characters XML 1.0 forbids, plus CR, which XML normalizes to LF.
const NOT_XML_TEXT = /[\u0000-\u0008\u000B-\u001F￾￿\r]|[\uD800-\uDFFF]/u;

const xmlText = fc
  .string({ unit: 'grapheme', maxLength: 30 })
  .filter((text) => !NOT_XML_TEXT.test(text));

// Micro-degrees, as exporters write them; String() of these never uses exponent notation.
const latitudeArbitrary = fc
  .integer({ min: -90e6, max: 90e6 })
  .map((n) => n / 1e6);
const longitudeArbitrary = fc
  .integer({ min: -180e6, max: 180e6 })
  .map((n) => n / 1e6);

const recentLogsArbitrary: fc.Arbitrary<RecentLog[]> = fc
  .array(
    fc.record({
      type: fc.constantFrom(...(Object.keys(LOG_TEXT) as RecentLogType[])),
      date: fc
        .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2099, 11, 31) })
        .map((time) => new Date(time).toISOString().slice(0, 10)),
    }),
    { maxLength: 5 },
  )
  .map((logs) => logs.sort((a, b) => b.date.localeCompare(a.date)));

const cacheArbitrary: fc.Arbitrary<Geocache> = fc.record(
  {
    code: fc.stringMatching(/^(GC|OC)[0-9A-Z]{1,6}$/),
    name: xmlText.map((text) => text.trim()).filter((text) => text !== ''),
    type: fc.constantFrom(...(Object.keys(TYPE_TEXT) as CacheType[])),
    difficulty: fc.integer({ min: 2, max: 10 }).map((steps) => steps / 2),
    terrain: fc.integer({ min: 2, max: 10 }).map((steps) => steps / 2),
    container: fc.constantFrom('Micro', 'Small', 'Regular', 'Not chosen', ''),
    available: fc.boolean(),
    archived: fc.boolean(),
    found: fc.boolean(),
    placedBy: xmlText.map((text) => text.trim()),
    hint: xmlText.map((text) => text.trim()),
    recentLogs: recentLogsArbitrary,
    // parseGpx knows no file name; importFiles fills these in.
    sources: fc.constant([]),
    parking: fc.record({
      latitude: latitudeArbitrary,
      longitude: longitudeArbitrary,
    }),
    latitude: latitudeArbitrary,
    longitude: longitudeArbitrary,
  },
  {
    requiredKeys: [
      'code',
      'name',
      'type',
      'difficulty',
      'terrain',
      'container',
      'available',
      'archived',
      'found',
      'placedBy',
      'hint',
      'recentLogs',
      'sources',
      'latitude',
      'longitude',
    ],
  },
);

// Parking areas are matched by the code without its prefix, so no two caches may share that.
const cachesArbitrary = fc.uniqueArray(cacheArbitrary, {
  maxLength: 8,
  selector: (cache) => cache.code.slice(2),
});

const flavourArbitrary = fc.constantFrom<GpxFlavour>(
  'pocket-query',
  'pocket-query-legacy',
  'gsak',
  'opencaching',
);

const maybeText = fc.option(xmlText, { nil: undefined });
const numberish = fc.oneof(
  maybeText,
  fc.double().map(String),
  fc.integer({ min: -400, max: 400 }).map((n) => String(n / 2)),
);

const waypointArbitrary: fc.Arbitrary<WaypointSpec> = fc.record({
  code: maybeText,
  lat: numberish,
  lon: numberish,
  sym: maybeText,
  cache: fc.option(
    fc.record({
      name: maybeText,
      type: maybeText,
      container: maybeText,
      difficulty: numberish,
      terrain: numberish,
      available: maybeText,
      archived: maybeText,
    }),
    { nil: undefined },
  ),
});

function isRating(value: number): boolean {
  return value >= 1 && value <= 5 && Number.isInteger(value * 2);
}

function expectValid(parsed: ParsedGpx): void {
  for (const cache of parsed.caches) {
    expect(cache.code).toMatch(/^\S([\s\S]*\S)?$/u);
    expect(cache.code).toBe(cache.code.toUpperCase());
    expect(Math.abs(cache.latitude)).toBeLessThanOrEqual(90);
    expect(Math.abs(cache.longitude)).toBeLessThanOrEqual(180);
    expect(isRating(cache.difficulty) && isRating(cache.terrain)).toBe(true);
    expect(Object.keys(TYPE_TEXT)).toContain(cache.type);
  }
  expect(Number.isInteger(parsed.skippedWaypoints)).toBe(true);
}

function parseOrRefusal(xml: string): ParsedGpx | GpxParseError {
  try {
    return parseGpx(xml);
  } catch (error) {
    if (error instanceof GpxParseError) return error;
    throw error;
  }
}

describe('parseGpx properties', () => {
  it('reads back every cache a generated document holds, in every exporter shape', () => {
    fc.assert(
      fc.property(cachesArbitrary, flavourArbitrary, (caches, flavour) => {
        const parked = caches.filter((cache) => cache.parking);
        expect(parseGpx(gpxOf(caches, flavour))).toEqual({
          caches,
          skippedWaypoints: parked.length,
          parkingAreas: parked.map(({ code, parking }) => ({
            name: `PK${code.slice(2)}`,
            ...parking,
          })),
        });
      }),
    );
  });

  it('accounts for every waypoint and returns only valid caches, whatever their values', () => {
    fc.assert(
      fc.property(fc.array(waypointArbitrary, { maxLength: 6 }), (specs) => {
        const parsed = parseGpx(buildGpx(specs));
        expectValid(parsed);
        expect(parsed.caches.length + parsed.skippedWaypoints).toBe(
          specs.length,
        );
      }),
    );
  });

  it('returns valid caches or a typed refusal for any text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (text) => {
        const outcome = parseOrRefusal(text);
        if (!(outcome instanceof GpxParseError)) expectValid(outcome);
      }),
    );
  });

  it('returns valid caches or a typed refusal for a damaged document', () => {
    const document = gpxOf([syntheticCache(1), syntheticCache(2)]);
    fc.assert(
      fc.property(
        fc.nat({ max: document.length }),
        fc.nat({ max: 40 }),
        fc.string({ maxLength: 12 }),
        (at, removed, inserted) => {
          const damaged =
            document.slice(0, at) + inserted + document.slice(at + removed);
          const outcome = parseOrRefusal(damaged);
          if (!(outcome instanceof GpxParseError)) expectValid(outcome);
        },
      ),
    );
  });
});

describe('parseGpx at Pocket Query scale', () => {
  it('reads 10,000 caches within a generous bound', { timeout: 30_000 }, () => {
    const caches = Array.from({ length: 10_000 }, (_, index) =>
      syntheticCache(index),
    );
    const xml = gpxOf(caches);
    const started = performance.now();
    const parsed = parseGpx(xml);
    const elapsed = performance.now() - started;
    expect(parsed.caches).toEqual(caches);
    expect(elapsed).toBeLessThan(10_000);
  });
});
