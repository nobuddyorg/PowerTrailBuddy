import JSZip from 'jszip';

import type { CacheType, Geocache, RecentLogType } from './types';

/** One `<groundspeak:log>`; a field left out is left out of the document. */
interface LogSpec {
  type?: string;
  date?: string;
}

/** The `<groundspeak:cache>` of a waypoint; a field left out is left out of the document. */
interface CacheSpec {
  name?: string;
  placedBy?: string;
  type?: string;
  container?: string;
  difficulty?: string | number;
  terrain?: string | number;
  hint?: string;
  logs?: LogSpec[];
  available?: string;
  archived?: string;
}

/** One `<wpt>`; without `cache` it is an additional waypoint (parking, stage). */
export interface WaypointSpec {
  code?: string;
  lat?: string | number;
  lon?: string | number;
  sym?: string;
  /** The waypoint's own `<type>`; 'Geocache' when left out, none at all in a GSAK export. */
  type?: string;
  cache?: CacheSpec;
}

/** The exporters the parser has to read alike. */
export type GpxFlavour =
  // GPX 1.0, groundspeak 1/0/1 straight under `<wpt>`, as geocaching.com writes it.
  | 'pocket-query'
  // The same with groundspeak 1/0.
  | 'pocket-query-legacy'
  // GPX 1.1, the cache inside `<extensions>` beside `gsak:` extras, fields in another order.
  | 'gsak'
  // An `oc:cache` element ahead of the groundspeak one.
  | 'opencaching';

export const TYPE_TEXT: Readonly<Record<CacheType, string>> = {
  traditional: 'Traditional Cache',
  multi: 'Multi-cache',
  mystery: 'Unknown Cache',
  letterbox: 'Letterbox Hybrid',
  wherigo: 'Wherigo Cache',
  earthcache: 'Earthcache',
  virtual: 'Virtual Cache',
  webcam: 'Webcam Cache',
  event: 'Event Cache',
  other: 'Locationless (Reverse) Cache',
};

const GPX_1_0 = 'http://www.topografix.com/GPX/1/0';
const GPX_1_1 = 'http://www.topografix.com/GPX/1/1';
const GROUNDSPEAK_1_0 = 'http://www.groundspeak.com/cache/1/0';
const GROUNDSPEAK_1_0_1 = 'http://www.groundspeak.com/cache/1/0/1';
const GSAK = 'http://www.gsak.net/xmlv1/6';
const OPENCACHING = 'https://github.com/opencaching/gpx-extension-v1';

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function element(tag: string, value: string | number | undefined): string {
  return value === undefined
    ? ''
    : `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

function attribute(name: string, value: string | number | undefined): string {
  return value === undefined ? '' : ` ${name}="${escapeXml(String(value))}"`;
}

function logElement(log: LogSpec, index: number): string {
  return (
    `<groundspeak:log id="${index + 1}">${element('groundspeak:date', log.date)}` +
    `${element('groundspeak:type', log.type)}` +
    `<groundspeak:finder id="7">Synthetic Finder</groundspeak:finder>` +
    `<groundspeak:text encoded="False">Synthetic log</groundspeak:text></groundspeak:log>`
  );
}

function logsElement(logs: readonly LogSpec[] | undefined): string {
  return logs === undefined
    ? ''
    : `<groundspeak:logs>${logs.map(logElement).join('')}</groundspeak:logs>`;
}

function cacheFields(cache: CacheSpec, reversed: boolean): string {
  const fields = [
    element('groundspeak:name', cache.name),
    element('groundspeak:placed_by', cache.placedBy),
    element('groundspeak:type', cache.type),
    element('groundspeak:container', cache.container),
    element('groundspeak:difficulty', cache.difficulty),
    element('groundspeak:terrain', cache.terrain),
    element('groundspeak:country', 'Nowhere'),
    element('groundspeak:encoded_hints', cache.hint),
    logsElement(cache.logs),
  ];
  return (reversed ? fields.reverse() : fields).join('');
}

function cacheElement(spec: WaypointSpec, flavour: GpxFlavour): string {
  const cache = spec.cache;
  if (!cache) return '';
  const namespace =
    flavour === 'pocket-query-legacy' ? GROUNDSPEAK_1_0 : GROUNDSPEAK_1_0_1;
  return (
    `<groundspeak:cache id="1"${attribute('available', cache.available)}` +
    `${attribute('archived', cache.archived)} xmlns:groundspeak="${namespace}">` +
    `${cacheFields(cache, flavour === 'gsak')}</groundspeak:cache>`
  );
}

function waypointElement(spec: WaypointSpec, flavour: GpxFlavour): string {
  const head =
    `<wpt${attribute('lat', spec.lat)}${attribute('lon', spec.lon)}>` +
    `<time>2001-02-03T04:05:06Z</time>${element('name', spec.code)}` +
    `<desc>Synthetic waypoint</desc>`;
  const sym = element('sym', spec.sym);
  const cache = cacheElement(spec, flavour);
  if (flavour === 'gsak') {
    const extras = `<gsak:wptExtension xmlns:gsak="${GSAK}"><gsak:Code>${escapeXml(spec.code ?? '')}</gsak:Code><gsak:FavPoints>3</gsak:FavPoints></gsak:wptExtension>`;
    return `${head}${sym}<extensions>${extras}${cache}</extensions></wpt>`;
  }
  const opencaching =
    flavour === 'opencaching'
      ? `<oc:cache xmlns:oc="${OPENCACHING}"><oc:type>Traditional Cache</oc:type><oc:size>Micro</oc:size></oc:cache>`
      : '';
  const type = element('type', spec.type ?? 'Geocache');
  return `${head}${sym}${type}${opencaching}${cache}</wpt>`;
}

/** A synthetic GPX document in the given exporter's shape. */
export function buildGpx(
  waypoints: readonly WaypointSpec[],
  flavour: GpxFlavour = 'pocket-query',
): string {
  const version = flavour === 'gsak' ? '1.1' : '1.0';
  const namespace = flavour === 'gsak' ? GPX_1_1 : GPX_1_0;
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<gpx version="${version}" creator="Synthetic fixture" xmlns="${namespace}">` +
    `<name>Synthetic Pocket Query</name><desc>Invented for tests</desc>` +
    `<bounds minlat="0" minlon="0" maxlat="1" maxlon="1"/>` +
    waypoints.map((spec) => waypointElement(spec, flavour)).join('\n') +
    `</gpx>`
  );
}

/** A plausible quick cache with an invented code, on a line north of an invented origin. */
export function syntheticCache(
  index: number,
  overrides: Partial<Geocache> = {},
): Geocache {
  return {
    code: `GC0T${index.toString(36).toUpperCase()}`,
    name: `Synthetic cache ${index}`,
    type: 'traditional',
    difficulty: 1.5,
    terrain: 1,
    container: 'Micro',
    available: true,
    archived: false,
    found: false,
    placedBy: 'Synthetic Owner',
    hint: '',
    recentLogs: [],
    sources: [],
    latitude: 10 + index * 0.001,
    longitude: 20,
    ...overrides,
  };
}

export const LOG_TEXT: Readonly<Record<RecentLogType, string>> = {
  found: 'Found it',
  dnf: "Didn't find it",
  note: 'Write note',
  maintenance: 'Needs Maintenance',
  disabled: 'Temporarily Disable Listing',
  other: 'Owner Maintenance',
};

/** The waypoint a Pocket Query writes for this cache. */
function waypointOf(cache: Geocache): WaypointSpec {
  return {
    code: cache.code,
    lat: cache.latitude,
    lon: cache.longitude,
    sym: cache.found ? 'Geocache Found' : 'Geocache',
    cache: {
      name: cache.name,
      placedBy: cache.placedBy,
      type: TYPE_TEXT[cache.type],
      container: cache.container,
      difficulty: cache.difficulty,
      terrain: cache.terrain,
      hint: cache.hint,
      logs: cache.recentLogs.map((log) => ({
        type: LOG_TEXT[log.type],
        date: `${log.date}T19:00:00Z`,
      })),
      available: cache.available ? 'True' : 'False',
      archived: cache.archived ? 'True' : 'False',
    },
  };
}

/** The additional waypoint a Pocket Query's `-wpts.gpx` writes for a parking area. */
export function parkingWaypoint(
  cacheCode: string,
  at: { latitude: number; longitude: number },
): WaypointSpec {
  return {
    code: `PK${cacheCode.slice(2)}`,
    lat: at.latitude,
    lon: at.longitude,
    sym: 'Parking Area',
    type: 'Waypoint|Parking Area',
  };
}

/** The caches' waypoints, then the parking areas of those that have one. */
export function gpxOf(
  caches: readonly Geocache[],
  flavour: GpxFlavour = 'pocket-query',
): string {
  const parking = caches.flatMap((cache) =>
    cache.parking ? [parkingWaypoint(cache.code, cache.parking)] : [],
  );
  return buildGpx([...caches.map(waypointOf), ...parking], flavour);
}

/** A DEFLATE archive of the given entries, in the given order. */
export async function buildZip(
  entries: Readonly<Record<string, string | Uint8Array>>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    // JSZip's own UTF-8 encoder splits surrogate pairs at its chunk boundaries; the copy puts the bytes in this realm.
    const bytes = new Uint8Array(
      typeof content === 'string' ? new TextEncoder().encode(content) : content,
    );
    zip.file(name, bytes, { createFolders: false });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const CENTRAL_HEADER_SIGNATURE = 0x02014b50;

/** Calls `patch` with the offset of each central-directory header, in archive order. */
function patchCentralDirectory(
  zip: Uint8Array,
  patch: (view: DataView, at: number, index: number) => void,
): Uint8Array {
  const patched = zip.slice();
  const view = new DataView(patched.buffer);
  let index = 0;
  for (let at = 0; at + 46 <= patched.length; at += 1) {
    if (view.getUint32(at, true) === CENTRAL_HEADER_SIGNATURE) {
      patch(view, at, index);
      index += 1;
    }
  }
  return patched;
}

/** Rewrites the uncompressed size each entry's directory record declares, as a lying archive would. */
export function withDeclaredSizes(
  zip: Uint8Array,
  sizes: readonly number[],
): Uint8Array {
  return patchCentralDirectory(zip, (view, at, index) => {
    const size = sizes[index];
    if (size !== undefined) view.setUint32(at + 24, size, true);
  });
}

/** Sets the MS-DOS directory attribute on one entry, whatever its name. */
export function withDirectoryFlag(zip: Uint8Array, entry: number): Uint8Array {
  return patchCentralDirectory(zip, (view, at, index) => {
    if (index === entry) view.setUint32(at + 38, 0x10, true);
  });
}

export function fileOf(content: string | Uint8Array, name: string): File {
  const part: BlobPart =
    typeof content === 'string' ? content : new Uint8Array(content);
  return new File([part], name);
}

/** A file reporting `size` bytes whatever it holds, so a size limit is tested without allocating it. */
export function withReportedSize(file: File, size: number): File {
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** A file the browser cannot read, as when it was deleted after being picked. */
export function unreadableFile(name: string): File {
  const file = new File(['gone'], name);
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.reject(new DOMException('gone', 'NotReadableError')),
  });
  return file;
}
