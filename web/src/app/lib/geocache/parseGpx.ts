import { namesParkingArea, withParking, type ParkingArea } from './parking';
import { recentLogsOf, type LogEntry } from './recentLogs';
import type { CacheType, Geocache } from './types';

export interface ParsedGpx {
  /** Each with the nearest parking area of this document, if it has one. */
  caches: Geocache[];
  /** Waypoints that carry no cache: additional waypoints, or ones with unusable coordinates or ratings. */
  skippedWaypoints: number;
  /** The additional waypoints of type Parking Area, for matching against caches of other files. */
  parkingAreas: ParkingArea[];
}

export type GpxParseErrorCode = 'not-xml' | 'not-gpx';

export class GpxParseError extends Error {
  readonly code: GpxParseErrorCode;

  constructor(code: GpxParseErrorCode) {
    super(`Unusable GPX: ${code}`);
    this.name = 'GpxParseError';
    this.code = code;
  }
}

// Matched as a prefix so 1/0, 1/0/1 and any later minor version all read alike.
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- an XML namespace name, compared, never fetched
const GROUNDSPEAK_NAMESPACE = 'http://www.groundspeak.com/cache/1/0';

const CACHE_TYPES: ReadonlyMap<string, CacheType> = new Map([
  ['traditional cache', 'traditional'],
  ['multi-cache', 'multi'],
  ['unknown cache', 'mystery'],
  ['mystery cache', 'mystery'],
  ['letterbox hybrid', 'letterbox'],
  ['wherigo cache', 'wherigo'],
  ['earthcache', 'earthcache'],
  ['virtual cache', 'virtual'],
  ['webcam cache', 'webcam'],
]);

const DECIMAL = /^[+-]?\d+(?:\.\d+)?$/;

function childrenNamed(parent: Element, localName: string): Element[] {
  return [...parent.children].filter((child) => child.localName === localName);
}

/** The trimmed text of the first child element with this local name, in any namespace; '' when absent. */
function childText(parent: Element, localName: string): string {
  return childrenNamed(parent, localName)[0]?.textContent.trim() ?? '';
}

function logEntriesOf(cache: Element): LogEntry[] {
  return childrenNamed(cache, 'logs')
    .flatMap((logs) => childrenNamed(logs, 'log'))
    .map((log) => ({
      type: childText(log, 'type'),
      date: childText(log, 'date'),
    }));
}

function decimalOrNaN(text: string | null): number {
  // A missing attribute (null) becomes 'null', which no decimal matches.
  const trimmed = String(text).trim();
  return DECIMAL.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function coordinateOrNaN(text: string | null, limit: number): number {
  const value = decimalOrNaN(text);
  return Math.abs(value) <= limit ? value : Number.NaN;
}

/** 1..5 in half steps, else NaN. */
function ratingOrNaN(text: string): number {
  const value = decimalOrNaN(text);
  return value >= 1 && value <= 5 && Number.isInteger(value * 2)
    ? value
    : Number.NaN;
}

function cacheTypeOf(text: string): CacheType {
  const key = text.toLowerCase();
  if (key.includes('event')) return 'event';
  return CACHE_TYPES.get(key) ?? 'other';
}

function flag(element: Element, name: string, absent: boolean): boolean {
  const value = element.getAttribute(name);
  return value === null ? absent : value.trim().toLowerCase() === 'true';
}

function cacheElementOf(waypoint: Element): Element | undefined {
  for (const element of waypoint.getElementsByTagNameNS('*', 'cache')) {
    if (element.namespaceURI?.startsWith(GROUNDSPEAK_NAMESPACE)) return element;
  }
  return undefined;
}

function coordinatesOf(waypoint: Element): [number, number] {
  return [
    coordinateOrNaN(waypoint.getAttribute('lat'), 90),
    coordinateOrNaN(waypoint.getAttribute('lon'), 180),
  ];
}

/** The cache a `<wpt>` describes, or undefined when it has none or an unusable value. */
function cacheOf(waypoint: Element, cache: Element): Geocache | undefined {
  const code = childText(waypoint, 'name').toUpperCase();
  if (code === '') return undefined;
  const [latitude, longitude] = coordinatesOf(waypoint);
  const difficulty = ratingOrNaN(childText(cache, 'difficulty'));
  const terrain = ratingOrNaN(childText(cache, 'terrain'));
  const numbers = [latitude, longitude, difficulty, terrain];
  if (numbers.some(Number.isNaN)) return undefined;
  return {
    code,
    name: childText(cache, 'name') || code,
    type: cacheTypeOf(childText(cache, 'type')),
    difficulty,
    terrain,
    container: childText(cache, 'container'),
    available: flag(cache, 'available', true),
    archived: flag(cache, 'archived', false),
    found: childText(waypoint, 'sym').toLowerCase() === 'geocache found',
    placedBy: childText(cache, 'placed_by'),
    hint: childText(cache, 'encoded_hints'),
    recentLogs: recentLogsOf(logEntriesOf(cache)),
    // The document knows no file name; importFiles names the query.
    sources: [],
    latitude,
    longitude,
  };
}

/** The parking area an additional `<wpt>` marks, or undefined when it marks something else. */
function parkingAreaOf(waypoint: Element): ParkingArea | undefined {
  const kinds = [childText(waypoint, 'sym'), childText(waypoint, 'type')];
  if (!kinds.some(namesParkingArea)) return undefined;
  const name = childText(waypoint, 'name').toUpperCase();
  const [latitude, longitude] = coordinatesOf(waypoint);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return undefined;
  return { name, latitude, longitude };
}

function gpxRootOf(xml: string): Element {
  // XML allows nothing before its declaration; hand-edited and shared files often start with a blank line.
  const document = new DOMParser().parseFromString(
    xml.trimStart(),
    'application/xml',
  );
  // Firefox and jsdom replace the root with <parsererror>; Chromium inserts one inside it.
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new GpxParseError('not-xml');
  }
  const root = document.documentElement;
  if (root.localName !== 'gpx') throw new GpxParseError('not-gpx');
  return root;
}

/** Reads the caches in one GPX document (Groundspeak extensions 1/0 or 1/0/1). */
export function parseGpx(xml: string): ParsedGpx {
  const root = gpxRootOf(xml);
  const caches: Geocache[] = [];
  const parkingAreas: ParkingArea[] = [];
  let skippedWaypoints = 0;
  for (const waypoint of root.children) {
    if (waypoint.localName !== 'wpt') continue;
    const cacheElement = cacheElementOf(waypoint);
    const cache = cacheElement && cacheOf(waypoint, cacheElement);
    if (cache) caches.push(cache);
    else skippedWaypoints += 1;
    const parkingArea = cacheElement ? undefined : parkingAreaOf(waypoint);
    if (parkingArea) parkingAreas.push(parkingArea);
  }
  return {
    caches: withParking(caches, parkingAreas),
    skippedWaypoints,
    parkingAreas,
  };
}
