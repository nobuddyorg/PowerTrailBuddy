// @vitest-environment jsdom
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { syntheticCache } from '../geocache/gpx.test-support';
import { parseGpx } from '../geocache/parseGpx';
import type { CacheType, Geocache } from '../geocache/types';
import type { Trail } from '../trails/types';
import { buildTrailGpx } from './trailGpx';

function trailOf(caches: Geocache[]): Trail {
  return {
    id: `${caches[0]?.code ?? 'none'}-${caches.length}`,
    caches,
    pathMeters: 100,
    returnMeters: 50,
    walkMeters: 195,
    durationMinutes: 9,
    cachesPerHour: 13,
    shape: 'line',
    center: { latitude: 0, longitude: 0 },
  };
}

function documentOf(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
  return document;
}

function textsOf(document: Document, path: string): string[] {
  return [...document.querySelectorAll(path)].map((node) => node.textContent);
}

const first = syntheticCache(1, {
  code: 'GC0TG1',
  name: 'Bench',
  container: 'Micro',
  difficulty: 1.5,
  terrain: 2,
  placedBy: 'Owner',
  hint: 'Magnetic',
  latitude: 52.5,
  longitude: -13.25,
  parking: { latitude: 52.4999, longitude: -13.2501 },
});
const second = syntheticCache(2, {
  code: 'GC0TG2',
  name: 'Lamp',
  type: 'mystery',
  container: '',
  difficulty: 2,
  terrain: 1,
  placedBy: '',
  latitude: 52.501,
  longitude: -13.25,
});

describe('buildTrailGpx', () => {
  it('writes waypoints, parking areas and a route in walking order', () => {
    expect(buildTrailGpx(trailOf([first, second]), 'Morning walk')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<gpx version="1.1" creator="PowerTrailBuddy" xmlns="http://www.topografix.com/GPX/1/1" xmlns:groundspeak="http://www.groundspeak.com/cache/1/0/1">\n' +
        '<metadata><name>Morning walk</name></metadata>\n' +
        '<wpt lat="52.500000" lon="-13.250000"><name>GC0TG1</name><desc>Bench (D1.5/T2, Micro)</desc><sym>Geocache</sym><type>Geocache|Traditional Cache</type>' +
        '<extensions><groundspeak:cache available="True" archived="False"><groundspeak:name>Bench</groundspeak:name><groundspeak:placed_by>Owner</groundspeak:placed_by>' +
        '<groundspeak:type>Traditional Cache</groundspeak:type><groundspeak:container>Micro</groundspeak:container><groundspeak:difficulty>1.5</groundspeak:difficulty>' +
        '<groundspeak:terrain>2</groundspeak:terrain><groundspeak:encoded_hints>Magnetic</groundspeak:encoded_hints></groundspeak:cache></extensions></wpt>\n' +
        '<wpt lat="52.501000" lon="-13.250000"><name>GC0TG2</name><desc>Lamp (D2/T1)</desc><sym>Geocache</sym><type>Geocache|Unknown Cache</type>' +
        '<extensions><groundspeak:cache available="True" archived="False"><groundspeak:name>Lamp</groundspeak:name><groundspeak:placed_by></groundspeak:placed_by>' +
        '<groundspeak:type>Unknown Cache</groundspeak:type><groundspeak:container></groundspeak:container><groundspeak:difficulty>2</groundspeak:difficulty>' +
        '<groundspeak:terrain>1</groundspeak:terrain><groundspeak:encoded_hints></groundspeak:encoded_hints></groundspeak:cache></extensions></wpt>\n' +
        '<wpt lat="52.499900" lon="-13.250100"><name>PK0TG1</name><desc>Bench</desc><sym>Parking Area</sym><type>Waypoint|Parking Area</type></wpt>\n' +
        '<rte><name>Morning walk</name>\n' +
        '<rtept lat="52.500000" lon="-13.250000"><name>GC0TG1</name></rtept>\n' +
        '<rtept lat="52.501000" lon="-13.250000"><name>GC0TG2</name></rtept>\n' +
        '</rte>\n</gpx>\n',
    );
  });

  it('writes the flags of a disabled, archived cache', () => {
    const xml = buildTrailGpx(
      trailOf([{ ...second, available: false, archived: true }]),
      'x',
    );
    expect(xml).toContain(
      '<groundspeak:cache available="False" archived="True">',
    );
  });

  const types: [CacheType, string][] = [
    ['traditional', 'Traditional Cache'],
    ['multi', 'Multi-cache'],
    ['mystery', 'Unknown Cache'],
    ['letterbox', 'Letterbox Hybrid'],
    ['wherigo', 'Wherigo Cache'],
    ['earthcache', 'Earthcache'],
    ['virtual', 'Virtual Cache'],
    ['webcam', 'Webcam Cache'],
    ['event', 'Event Cache'],
    ['other', 'Other'],
  ];
  for (const [type, text] of types) {
    it(`writes the type ${type} as ${text}, which reads back as ${type}`, () => {
      const xml = buildTrailGpx(trailOf([{ ...second, type }]), 'x');
      expect(xml).toContain(`<type>Geocache|${text}</type>`);
      expect(parseGpx(xml).caches[0]?.type).toBe(type);
    });
  }

  it('escapes markup in names, hints, owners and the title', () => {
    const markup = `<b>Tom & "Jerry's"</b> ]]>`;
    const cache = {
      ...first,
      name: markup,
      hint: markup,
      placedBy: markup,
      container: markup,
    };
    const xml = buildTrailGpx(trailOf([cache]), markup);
    const document = documentOf(xml);
    expect(document.getElementsByTagName('b')).toHaveLength(0);
    expect(textsOf(document, 'metadata > name, rte > name')).toEqual([
      markup,
      markup,
    ]);
    expect(textsOf(document, 'wpt > desc')).toEqual([
      `${markup} (D1.5/T2, ${markup})`,
      markup,
    ]);
    expect(xml).toContain(
      '&lt;b&gt;Tom &amp; &quot;Jerry&apos;s&quot;&lt;/b&gt; ]]&gt;',
    );
  });

  it('drops characters XML cannot carry and keeps every other one', () => {
    const name = 'A\u0000B\u0008C\u000BD\u001FE￾F￿G\uD800H\uDFFFI';
    const kept = 'Tab\there\nlineä€😀� ';
    const xml = buildTrailGpx(trailOf([{ ...first, name: name + kept }]), 'x');
    expect(textsOf(documentOf(xml), 'wpt > desc')[1]).toBe(`ABCDEFGHI${kept}`);
  });

  it('reads back as the same caches and parking areas through the importer', () => {
    const parsed = parseGpx(buildTrailGpx(trailOf([first, second]), 'x'));
    expect(parsed.caches).toEqual([first, second]);
    expect(parsed.parkingAreas).toEqual([{ name: 'PK0TG1', ...first.parking }]);
  });
});

// Characters XML 1.0 forbids, plus CR, which XML normalizes to LF.
const NOT_XML_TEXT = /[\u0000-\u0008\u000B-\u001F￾￿\r]|[\uD800-\uDFFF]/u;
const text = fc
  .string({ unit: 'grapheme', maxLength: 20 })
  .filter((value) => !NOT_XML_TEXT.test(value))
  .map((value) => value.trim());
const degrees = (limit: number) =>
  fc.double({ min: -limit, max: limit, noNaN: true });

const cacheArbitrary = fc.record({
  code: fc.stringMatching(/^GC[0-9A-Z]{1,5}$/),
  name: text.filter((value) => value !== ''),
  placedBy: text,
  hint: text,
  container: text,
  difficulty: fc.integer({ min: 2, max: 10 }).map((steps) => steps / 2),
  terrain: fc.integer({ min: 2, max: 10 }).map((steps) => steps / 2),
  latitude: degrees(90),
  longitude: degrees(180),
  parking: fc.option(
    fc.record({ latitude: degrees(90), longitude: degrees(180) }),
    {
      nil: undefined,
    },
  ),
});

/** Everything but the positions, which come back rounded. */
function detailsOf(
  cache: Geocache,
): Omit<Geocache, 'latitude' | 'longitude' | 'parking' | 'sources'> {
  const { code, name, type, difficulty, terrain, container } = cache;
  const { available, archived, found, placedBy, hint, recentLogs } = cache;
  return {
    code,
    name,
    type,
    difficulty,
    terrain,
    container,
    available,
    archived,
    found,
    placedBy,
    hint,
    recentLogs,
  };
}

function closeTo(actual: number | undefined, expected: number): boolean {
  return actual !== undefined && Math.abs(actual - expected) <= 5e-7 + 1e-12;
}

describe('buildTrailGpx properties', () => {
  it('writes every coordinate in fixed-point notation, within half a micro-degree', () => {
    fc.assert(
      fc.property(degrees(90), degrees(180), (latitude, longitude) => {
        const xml = buildTrailGpx(
          trailOf([{ ...first, latitude, longitude, parking: undefined }]),
          'x',
        );
        const point = documentOf(xml).querySelector('rtept');
        const lat = point?.getAttribute('lat') ?? '';
        const lon = point?.getAttribute('lon') ?? '';
        expect(lat).toMatch(/^-?\d{1,2}\.\d{6}$/);
        expect(lon).toMatch(/^-?\d{1,3}\.\d{6}$/);
        expect(
          closeTo(Number(lat), latitude) && closeTo(Number(lon), longitude),
        ).toBe(true);
      }),
    );
  });

  it('reads back every field through the importer, whatever the text', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(cacheArbitrary, {
          minLength: 1,
          maxLength: 6,
          selector: (cache) => cache.code.slice(2),
        }),
        text,
        (specs, title) => {
          const caches = specs.map((spec, index) => {
            const { parking, ...rest } = spec;
            return syntheticCache(index, parking ? { ...rest, parking } : rest);
          });
          const xml = buildTrailGpx(trailOf(caches), title);
          const document = documentOf(xml);
          expect(textsOf(document, 'metadata > name')).toEqual([title]);
          expect(textsOf(document, 'rtept > name')).toEqual(
            caches.map((cache) => cache.code),
          );
          const parsed = parseGpx(xml).caches;
          expect(parsed.map(detailsOf)).toEqual(caches.map(detailsOf));
          for (const [index, cache] of caches.entries()) {
            expect(closeTo(parsed[index]?.latitude, cache.latitude)).toBe(true);
            expect(closeTo(parsed[index]?.longitude, cache.longitude)).toBe(
              true,
            );
            expect(parsed[index]?.parking === undefined).toBe(
              cache.parking === undefined,
            );
            if (cache.parking) {
              expect(
                closeTo(
                  parsed[index]?.parking?.latitude,
                  cache.parking.latitude,
                ),
              ).toBe(true);
              expect(
                closeTo(
                  parsed[index]?.parking?.longitude,
                  cache.parking.longitude,
                ),
              ).toBe(true);
            }
          }
        },
      ),
    );
  });
});
