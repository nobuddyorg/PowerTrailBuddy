import type { CacheType, Coordinates, Geocache } from '../geocache/types';
import { withoutNotXmlCharacters } from '../geocache/xmlCharacters';
import type { Trail } from '../trails/types';

// eslint-disable-next-line sonarjs/no-clear-text-protocols -- an XML namespace name, never fetched
const GPX_NAMESPACE = 'http://www.topografix.com/GPX/1/1';
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- an XML namespace name, never fetched
const GROUNDSPEAK_NAMESPACE = 'http://www.groundspeak.com/cache/1/0/1';

const TYPE_TEXT: Readonly<Record<CacheType, string>> = {
  traditional: 'Traditional Cache',
  multi: 'Multi-cache',
  mystery: 'Unknown Cache',
  letterbox: 'Letterbox Hybrid',
  wherigo: 'Wherigo Cache',
  earthcache: 'Earthcache',
  virtual: 'Virtual Cache',
  webcam: 'Webcam Cache',
  event: 'Event Cache',
  other: 'Other',
};

function escapeXml(text: string): string {
  return withoutNotXmlCharacters(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function element(tag: string, text: string): string {
  return `<${tag}>${escapeXml(text)}</${tag}>`;
}

/** Fixed-point degrees: never exponent notation, which GPX's xsd:decimal forbids; 6 places is about 10 cm. */
function formatDegrees(degrees: number): string {
  return degrees.toFixed(6);
}

function position(point: Coordinates): string {
  return `lat="${formatDegrees(point.latitude)}" lon="${formatDegrees(point.longitude)}"`;
}

function flag(value: boolean): string {
  return value ? 'True' : 'False';
}

function summaryOf(cache: Geocache): string {
  const container = cache.container === '' ? '' : `, ${cache.container}`;
  return `${cache.name} (D${cache.difficulty}/T${cache.terrain}${container})`;
}

function cacheExtension(cache: Geocache): string {
  return (
    `<groundspeak:cache available="${flag(cache.available)}" archived="${flag(cache.archived)}">` +
    element('groundspeak:name', cache.name) +
    element('groundspeak:placed_by', cache.placedBy) +
    element('groundspeak:type', TYPE_TEXT[cache.type]) +
    element('groundspeak:container', cache.container) +
    element('groundspeak:difficulty', String(cache.difficulty)) +
    element('groundspeak:terrain', String(cache.terrain)) +
    element('groundspeak:encoded_hints', cache.hint) +
    `</groundspeak:cache>`
  );
}

function cacheWaypoint(cache: Geocache): string {
  return (
    `<wpt ${position(cache)}>` +
    element('name', cache.code) +
    element('desc', summaryOf(cache)) +
    element('sym', 'Geocache') +
    element('type', `Geocache|${TYPE_TEXT[cache.type]}`) +
    `<extensions>${cacheExtension(cache)}</extensions></wpt>`
  );
}

/** Named like Geocaching.com names a parking waypoint: the cache code with its prefix swapped for PK. */
function parkingWaypoint(cache: Geocache, parking: Coordinates): string {
  return (
    `<wpt ${position(parking)}>` +
    element('name', `PK${cache.code.slice(2)}`) +
    element('desc', cache.name) +
    element('sym', 'Parking Area') +
    element('type', 'Waypoint|Parking Area') +
    `</wpt>`
  );
}

function routePoint(cache: Geocache): string {
  return `<rtept ${position(cache)}>${element('name', cache.code)}</rtept>`;
}

/** GPX 1.1 of a trail: a waypoint per cache with its Groundspeak details, its parking areas, and a route in walking order. */
export function buildTrailGpx(trail: Trail, title: string): string {
  const parking = trail.caches.flatMap((cache) =>
    cache.parking ? [parkingWaypoint(cache, cache.parking)] : [],
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="PowerTrailBuddy" xmlns="${GPX_NAMESPACE}" xmlns:groundspeak="${GROUNDSPEAK_NAMESPACE}">\n` +
    `<metadata>${element('name', title)}</metadata>\n` +
    [...trail.caches.map(cacheWaypoint), ...parking]
      .map((line) => `${line}\n`)
      .join('') +
    `<rte>${element('name', title)}\n` +
    trail.caches.map((cache) => `${routePoint(cache)}\n`).join('') +
    `</rte>\n</gpx>\n`
  );
}
