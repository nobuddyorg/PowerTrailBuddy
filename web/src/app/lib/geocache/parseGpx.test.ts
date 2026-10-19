// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  buildGpx,
  gpxOf,
  syntheticCache,
  type GpxFlavour,
  type WaypointSpec,
} from './gpx.test-support';
import { GpxParseError, parseGpx } from './parseGpx';
import type { CacheType, Geocache } from './types';

const QUICK_CACHE = {
  name: 'Synthetic Bench',
  placedBy: 'Synthetic Owner',
  hint: 'Under the bench',
  logs: [{ type: 'Found it', date: '2001-02-03T19:00:00Z' }],
  type: 'Traditional Cache',
  container: 'Micro',
  difficulty: 1.5,
  terrain: 2,
  available: 'True',
  archived: 'False',
};

function waypoint(overrides: WaypointSpec = {}): WaypointSpec {
  return {
    code: 'GC0TEST1',
    lat: 52.123456,
    lon: 13.654321,
    sym: 'Geocache',
    cache: QUICK_CACHE,
    ...overrides,
  };
}

function cacheWith(spec: WaypointSpec['cache']): WaypointSpec {
  return waypoint({ cache: { ...QUICK_CACHE, ...spec } });
}

function onlyCache(spec: WaypointSpec): Geocache | undefined {
  return parseGpx(buildGpx([spec])).caches[0];
}

function refusalOf(xml: string): string {
  try {
    parseGpx(xml);
  } catch (error) {
    if (error instanceof GpxParseError) return error.code;
    throw error;
  }
  return 'accepted';
}

const EXPECTED_BENCH: Geocache = {
  code: 'GC0TEST1',
  name: 'Synthetic Bench',
  type: 'traditional',
  difficulty: 1.5,
  terrain: 2,
  container: 'Micro',
  available: true,
  archived: false,
  found: false,
  placedBy: 'Synthetic Owner',
  hint: 'Under the bench',
  recentLogs: [{ type: 'found', date: '2001-02-03' }],
  latitude: 52.123456,
  longitude: 13.654321,
};

describe('parseGpx: exporter variants', () => {
  const flavours: GpxFlavour[] = [
    'pocket-query',
    'pocket-query-legacy',
    'gsak',
    'opencaching',
  ];
  for (const flavour of flavours) {
    it(`reads every field of a ${flavour} export`, () => {
      expect(parseGpx(buildGpx([waypoint()], flavour))).toEqual({
        caches: [EXPECTED_BENCH],
        skippedWaypoints: 0,
        parkingAreas: [],
      });
    });
  }

  it('reads Opencaching codes', () => {
    const cache = syntheticCache(1, { code: 'OC0ABC' });
    expect(parseGpx(gpxOf([cache], 'opencaching')).caches).toEqual([cache]);
  });

  it('reads several caches in document order', () => {
    const caches = [syntheticCache(1), syntheticCache(2), syntheticCache(3)];
    expect(parseGpx(gpxOf(caches)).caches).toEqual(caches);
  });

  it('reads a document whose gpx root has no namespace', () => {
    const xml = buildGpx([waypoint()]).replace(
      ' xmlns="http://www.topografix.com/GPX/1/0"',
      '',
    );
    expect(parseGpx(xml).caches).toEqual([EXPECTED_BENCH]);
  });

  it('reads a document with blank lines before its XML declaration', () => {
    expect(parseGpx(`\n \t\r\n${buildGpx([waypoint()])}`).caches).toEqual([
      EXPECTED_BENCH,
    ]);
  });

  it('decodes character and entity references in names', () => {
    const xml = buildGpx([cacheWith({ name: 'NAME' })]).replace(
      'NAME',
      'Tom &amp; Jerry &#228;&#x00FC; &lt;3',
    );
    expect(parseGpx(xml).caches[0]?.name).toBe('Tom & Jerry äü <3');
  });

  it('keeps markup in a name as literal text', () => {
    const name = '<img src=x onerror=alert(1)>';
    expect(onlyCache(cacheWith({ name }))?.name).toBe(name);
  });
});

describe('parseGpx: fields', () => {
  const types: [string | undefined, CacheType][] = [
    ['Traditional Cache', 'traditional'],
    ['TRADITIONAL CACHE', 'traditional'],
    ['Multi-cache', 'multi'],
    ['Unknown Cache', 'mystery'],
    ['Mystery Cache', 'mystery'],
    ['Letterbox Hybrid', 'letterbox'],
    ['Wherigo Cache', 'wherigo'],
    ['Earthcache', 'earthcache'],
    ['Virtual Cache', 'virtual'],
    ['Webcam Cache', 'webcam'],
    ['Event Cache', 'event'],
    ['Mega-Event Cache', 'event'],
    ['Cache In Trash Out Event', 'event'],
    ['Community Celebration Event', 'event'],
    ['Lab Cache', 'other'],
    ['Traditional', 'other'],
    [undefined, 'other'],
  ];
  for (const [text, type] of types) {
    it(`maps the type ${String(text)} to ${type}`, () => {
      expect(onlyCache(cacheWith({ type: text }))?.type).toBe(type);
    });
  }

  const flags: [string | undefined, boolean, boolean][] = [
    ['True', true, true],
    ['true', true, true],
    [' TRUE ', true, true],
    ['False', false, false],
    ['false', false, false],
    ['yes', false, false],
    [undefined, true, false],
  ];
  for (const [text, available, archived] of flags) {
    it(`reads the attribute value ${String(text)} as available ${available}, archived ${archived}`, () => {
      const cache = onlyCache(cacheWith({ available: text, archived: text }));
      expect([cache?.available, cache?.archived]).toEqual([
        available,
        archived,
      ]);
    });
  }

  const symbols: [string | undefined, boolean][] = [
    ['Geocache Found', true],
    ['geocache found', true],
    ['Geocache', false],
    ['Geocache Found Not', false],
    [undefined, false],
  ];
  for (const [sym, found] of symbols) {
    it(`reads <sym>${String(sym)}</sym> as found ${found}`, () => {
      expect(onlyCache(waypoint({ sym }))?.found).toBe(found);
    });
  }

  it('upper-cases and trims the code', () => {
    expect(onlyCache(waypoint({ code: '  gc0abc ' }))?.code).toBe('GC0ABC');
  });

  it('trims names and containers', () => {
    const cache = onlyCache(
      cacheWith({ name: '  Spaced  out ', container: ' Small ' }),
    );
    expect([cache?.name, cache?.container]).toEqual(['Spaced  out', 'Small']);
  });

  for (const name of [undefined, '   ']) {
    it(`names a cache by its code when its name is ${JSON.stringify(name)}`, () => {
      expect(onlyCache(cacheWith({ name }))?.name).toBe('GC0TEST1');
    });
  }

  it('reads a missing container as empty', () => {
    expect(onlyCache(cacheWith({ container: undefined }))?.container).toBe('');
  });

  it('reads ratings from the cache element, not elsewhere in the waypoint', () => {
    const xml = buildGpx([waypoint()]).replace(
      '<desc>Synthetic waypoint</desc>',
      '<difficulty>5</difficulty><terrain>5</terrain>',
    );
    const cache = parseGpx(xml).caches[0];
    expect([cache?.difficulty, cache?.terrain]).toEqual([1.5, 2]);
  });
});

describe('parseGpx: skipped waypoints', () => {
  it('skips and counts additional waypoints, which carry no cache', () => {
    const stage = waypoint({
      code: 'S10TEST1',
      sym: 'Stage',
      cache: undefined,
    });
    expect(parseGpx(buildGpx([stage, waypoint(), stage]))).toEqual({
      caches: [EXPECTED_BENCH],
      skippedWaypoints: 2,
      parkingAreas: [],
    });
  });

  it('counts only <wpt> elements, not routes, tracks or metadata', () => {
    const xml = buildGpx([waypoint()]).replace(
      '</gpx>',
      '<rte><rtept lat="1" lon="2"/></rte><trk/><extensions/></gpx>',
    );
    expect(parseGpx(xml).skippedWaypoints).toBe(0);
  });

  it('skips a cache element outside the Groundspeak namespace', () => {
    const xml = buildGpx([waypoint()]).replaceAll('groundspeak:cache', 'cache');
    expect(parseGpx(xml)).toEqual({
      caches: [],
      skippedWaypoints: 1,
      parkingAreas: [],
    });
  });

  it('skips a cache element in no namespace at all', () => {
    const xml = buildGpx([waypoint()])
      .replace(' xmlns="http://www.topografix.com/GPX/1/0"', '')
      .replaceAll('groundspeak:cache', 'cache');
    expect(parseGpx(xml)).toEqual({
      caches: [],
      skippedWaypoints: 1,
      parkingAreas: [],
    });
  });

  for (const code of [undefined, '', '   ']) {
    it(`skips a waypoint whose code is ${JSON.stringify(code)}`, () => {
      expect(parseGpx(buildGpx([waypoint({ code })])).skippedWaypoints).toBe(1);
    });
  }

  const latitudes: [string | undefined, number | undefined][] = [
    ['52.5', 52.5],
    ['+52.5', 52.5],
    ['-52.5', -52.5],
    [' 52.5 ', 52.5],
    ['90', 90],
    ['-90', -90],
    ['0', 0],
    ['90.000001', undefined],
    ['-90.000001', undefined],
    ['', undefined],
    [undefined, undefined],
    ['abc', undefined],
    ['52.5abc', undefined],
    ['x52.5', undefined],
    ['52,5', undefined],
    ['5e1', undefined],
    ['0x10', undefined],
    ['.5', undefined],
    ['52.', undefined],
    ['-', undefined],
    ['NaN', undefined],
    ['Infinity', undefined],
  ];
  for (const [lat, expected] of latitudes) {
    it(`reads the latitude ${JSON.stringify(lat)} as ${String(expected)}`, () => {
      expect(onlyCache(waypoint({ lat }))?.latitude).toBe(expected);
    });
  }

  const longitudes: [string | undefined, number | undefined][] = [
    ['180', 180],
    ['-180', -180],
    ['-13.25', -13.25],
    ['180.000001', undefined],
    ['-180.000001', undefined],
    [undefined, undefined],
  ];
  for (const [lon, expected] of longitudes) {
    it(`reads the longitude ${JSON.stringify(lon)} as ${String(expected)}`, () => {
      expect(onlyCache(waypoint({ lon }))?.longitude).toBe(expected);
    });
  }

  const ratings: [string | undefined, number | undefined][] = [
    ['1', 1],
    ['1.0', 1],
    ['1.5', 1.5],
    ['4.5', 4.5],
    ['5', 5],
    [' 2 ', 2],
    ['0.5', undefined],
    ['0', undefined],
    ['5.5', undefined],
    ['6', undefined],
    ['1.3', undefined],
    ['2.25', undefined],
    ['1,5', undefined],
    ['', undefined],
    [undefined, undefined],
    ['easy', undefined],
  ];
  for (const [rating, expected] of ratings) {
    it(`reads the difficulty ${JSON.stringify(rating)} as ${String(expected)}`, () => {
      expect(onlyCache(cacheWith({ difficulty: rating }))?.difficulty).toBe(
        expected,
      );
    });
    it(`reads the terrain ${JSON.stringify(rating)} as ${String(expected)}`, () => {
      expect(onlyCache(cacheWith({ terrain: rating }))?.terrain).toBe(expected);
    });
  }
});

describe('parseGpx: refusals', () => {
  const notXml: [string, string][] = [
    ['an empty string', ''],
    ['plain text', 'GC0TEST1 52.5 13.4'],
    ['HTML that is not well-formed', '<html><body><p>Hi<br></body></html>'],
    ['a truncated document', buildGpx([waypoint()]).slice(0, 300)],
    ['an HTML entity XML does not define', '<gpx><name>&auml;</name></gpx>'],
    ['a zip archive read as text', 'PK\u0003\u0004\u0014\u0000'],
  ];
  for (const [label, xml] of notXml) {
    it(`refuses ${label} as not-xml`, () => {
      expect(refusalOf(xml)).toBe('not-xml');
    });
  }

  const notGpx: [string, string][] = [
    ['well-formed HTML', '<html><body><p>Hi</p></body></html>'],
    ['KML', '<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>'],
    ['a gpx element below another root', '<root><gpx/></root>'],
  ];
  for (const [label, xml] of notGpx) {
    it(`refuses ${label} as not-gpx`, () => {
      expect(refusalOf(xml)).toBe('not-gpx');
    });
  }

  it('is an Error naming its code', () => {
    const error = new GpxParseError('not-gpx');
    expect([error instanceof Error, error.name, error.message]).toEqual([
      true,
      'GpxParseError',
      'Unusable GPX: not-gpx',
    ]);
  });

  it('does not expand nested internal entities (billion laughs)', () => {
    const bomb =
      '<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY a "aaaaaaaaaa">' +
      Array.from(
        { length: 9 },
        (_, level) =>
          `<!ENTITY ${String.fromCharCode(98 + level)} "${`&${String.fromCharCode(97 + level)};`.repeat(10)}">`,
      ).join('') +
      ']><gpx><name>&j;</name></gpx>';
    const outcome = refusalOf(bomb);
    expect(['accepted', 'not-xml']).toContain(outcome);
  });
});
