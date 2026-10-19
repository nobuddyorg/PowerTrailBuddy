// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  buildGpx,
  parkingWaypoint,
  type GpxFlavour,
  type WaypointSpec,
} from './gpx.test-support';
import { parseGpx } from './parseGpx';
import type { Geocache } from './types';

const BENCH = {
  name: 'Synthetic Bench',
  type: 'Traditional Cache',
  difficulty: 1.5,
  terrain: 2,
};

function bench(cache: WaypointSpec['cache'] = {}): WaypointSpec {
  return {
    code: 'GC0TEST1',
    lat: 52.1,
    lon: 13.6,
    sym: 'Geocache',
    cache: { ...BENCH, ...cache },
  };
}

function onlyCache(spec: WaypointSpec): Geocache | undefined {
  return parseGpx(buildGpx([spec])).caches[0];
}

const AT_PARKING = { latitude: 52.101, longitude: 13.6 };

describe('parseGpx: owner and hint', () => {
  it('reads the owner and the hint, trimmed', () => {
    const cache = onlyCache(
      bench({
        placedBy: '  Synthetic Owner ',
        hint: '\n Magnetic, under the rail \n',
      }),
    );
    expect([cache?.placedBy, cache?.hint]).toEqual([
      'Synthetic Owner',
      'Magnetic, under the rail',
    ]);
  });

  it('reads a missing owner and hint as empty', () => {
    const cache = onlyCache(bench());
    expect([cache?.placedBy, cache?.hint]).toEqual(['', '']);
  });

  it('keeps line breaks and markup inside a hint as text', () => {
    const hint = 'Line one\nLine <b>two</b> & more';
    expect(onlyCache(bench({ hint }))?.hint).toBe(hint);
  });
});

describe('parseGpx: recent logs', () => {
  it('reads the logs newest first, mapped to their kind', () => {
    const logs = [
      { type: 'Write note', date: '2001-01-01T10:00:00Z' },
      { type: "Didn't find it", date: '2001-03-01T10:00:00Z' },
      { type: 'Needs Maintenance', date: '2001-02-01T10:00:00Z' },
    ];
    expect(onlyCache(bench({ logs }))?.recentLogs).toEqual([
      { type: 'dnf', date: '2001-03-01' },
      { type: 'maintenance', date: '2001-02-01' },
      { type: 'note', date: '2001-01-01' },
    ]);
  });

  it('reads no logs as an empty list', () => {
    expect(onlyCache(bench())?.recentLogs).toEqual([]);
    expect(onlyCache(bench({ logs: [] }))?.recentLogs).toEqual([]);
  });

  it('drops a log without a date and reads one without a type as other', () => {
    const logs = [{ type: 'Found it' }, { date: '2001-01-01' }];
    expect(onlyCache(bench({ logs }))?.recentLogs).toEqual([
      { type: 'other', date: '2001-01-01' },
    ]);
  });

  it('reads only logs inside the logs element of the cache', () => {
    const xml = buildGpx([bench()]).replace(
      '</groundspeak:cache>',
      '<groundspeak:log><groundspeak:date>2001-01-01</groundspeak:date>' +
        '<groundspeak:type>Found it</groundspeak:type></groundspeak:log>' +
        '<groundspeak:logs><groundspeak:entry><groundspeak:date>2001-01-02</groundspeak:date>' +
        '</groundspeak:entry></groundspeak:logs></groundspeak:cache>',
    );
    expect(parseGpx(xml).caches[0]?.recentLogs).toEqual([]);
  });

  it('reads the logs of every logs element', () => {
    const xml = buildGpx([
      bench({ logs: [{ type: 'Found it', date: '2001-01-01' }] }),
    ]).replace(
      '</groundspeak:cache>',
      '<groundspeak:logs><groundspeak:log><groundspeak:date>2001-01-02</groundspeak:date>' +
        '<groundspeak:type>Write note</groundspeak:type></groundspeak:log></groundspeak:logs></groundspeak:cache>',
    );
    expect(parseGpx(xml).caches[0]?.recentLogs).toEqual([
      { type: 'note', date: '2001-01-02' },
      { type: 'found', date: '2001-01-01' },
    ]);
  });
});

describe('parseGpx: parking areas', () => {
  const flavours: GpxFlavour[] = [
    'pocket-query',
    'pocket-query-legacy',
    'gsak',
    'opencaching',
  ];
  for (const flavour of flavours) {
    it(`gives a cache its parking area from the same ${flavour} document`, () => {
      const parsed = parseGpx(
        buildGpx([parkingWaypoint('GC0TEST1', AT_PARKING), bench()], flavour),
      );
      expect(parsed.caches[0]?.parking).toEqual(AT_PARKING);
      expect(parsed.parkingAreas).toEqual([
        { name: 'PK0TEST1', ...AT_PARKING },
      ]);
      expect(parsed.skippedWaypoints).toBe(1);
    });
  }

  const kinds: [string, Partial<WaypointSpec>, boolean][] = [
    ['by its symbol alone', { sym: 'Parking Area', type: 'Waypoint' }, true],
    ['by its type alone', { sym: 'Flag', type: 'Waypoint|Parking Area' }, true],
    [
      'not a stage',
      {
        sym: 'Stages of a Multicache',
        type: 'Waypoint|Stages of a Multicache',
      },
      false,
    ],
    [
      'not a reference point',
      { sym: 'Reference Point', type: 'Waypoint|Reference Point' },
      false,
    ],
  ];
  for (const [label, spec, isParking] of kinds) {
    it(`recognises a parking area ${label}`, () => {
      const waypoint = { ...parkingWaypoint('GC0TEST1', AT_PARKING), ...spec };
      const parsed = parseGpx(buildGpx([bench(), waypoint]));
      expect(parsed.parkingAreas.length).toBe(isParking ? 1 : 0);
      expect(parsed.caches[0]?.parking).toEqual(
        isParking ? AT_PARKING : undefined,
      );
    });
  }

  it('upper-cases and trims the parking area name', () => {
    const waypoint = {
      ...parkingWaypoint('GC0TEST1', AT_PARKING),
      code: ' pk0test1 ',
    };
    expect(parseGpx(buildGpx([waypoint])).parkingAreas).toEqual([
      { name: 'PK0TEST1', ...AT_PARKING },
    ]);
  });

  const unusable: [string, Partial<WaypointSpec>][] = [
    ['latitude', { lat: '95' }],
    ['longitude', { lon: 'east' }],
  ];
  for (const [label, spec] of unusable) {
    it(`skips a parking area with an unusable ${label}`, () => {
      const waypoint = { ...parkingWaypoint('GC0TEST1', AT_PARKING), ...spec };
      const parsed = parseGpx(buildGpx([bench(), waypoint]));
      expect(parsed.parkingAreas).toEqual([]);
      expect(parsed.caches[0]?.parking).toBeUndefined();
    });
  }

  it('never takes a cache for a parking area, whatever its symbol', () => {
    const parsed = parseGpx(
      buildGpx([{ ...bench(), sym: 'Parking Area', code: 'PK0TEST1' }]),
    );
    expect(parsed.parkingAreas).toEqual([]);
    expect(parsed.caches.map((cache) => cache.code)).toEqual(['PK0TEST1']);
  });

  it('counts a parking area with an unusable cache element as skipped, not parking', () => {
    const waypoint: WaypointSpec = {
      ...parkingWaypoint('GC0TEST1', AT_PARKING),
      cache: { difficulty: 'easy' },
    };
    expect(parseGpx(buildGpx([waypoint]))).toEqual({
      caches: [],
      skippedWaypoints: 1,
      parkingAreas: [],
    });
  });
});
