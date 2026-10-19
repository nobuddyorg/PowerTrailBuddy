import JSZip from 'jszip';

// Synthetic only: invented codes, names and coordinates in the shape geocaching.com writes a Pocket Query.

export interface E2eCache {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  difficulty?: number;
  found?: boolean;
  hint?: string;
  /** Newest first, as geocaching.com writes them; one find when not given. */
  logs?: readonly { type: string; date: string }[];
}

const METERS_PER_DEGREE_LATITUDE = 111_195;
const ORIGIN = { latitude: 50.3, longitude: 8.9 };

function metersPerDegreeLongitude(latitude: number) {
  return METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);
}

/** The point `east` and `north` metres from the origin. */
export function offset(east: number, north = 0) {
  const latitude = ORIGIN.latitude + north / METERS_PER_DEGREE_LATITUDE;
  return {
    latitude,
    longitude: ORIGIN.longitude + east / metersPerDegreeLongitude(latitude),
  };
}

const DNF_STREAK_LOGS = [
  { type: "Didn't find it", date: '2026-09-20T00:00:00Z' },
  { type: "Didn't find it", date: '2026-09-12T00:00:00Z' },
  { type: 'Found it', date: '2026-08-01T00:00:00Z' },
];

const MAINTENANCE_LOGS = [
  { type: 'Needs Maintenance', date: '2026-09-18T00:00:00Z' },
  { type: 'Found it', date: '2026-09-02T00:00:00Z' },
];

const ONE_FIND = [{ type: 'Found it', date: '2026-09-01T00:00:00Z' }];

function chain({
  prefix,
  count,
  spacingMeters,
  north,
}: {
  prefix: string;
  count: number;
  spacingMeters: number;
  north: number;
}): E2eCache[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      code: `${prefix}${number}`,
      name: `E2E ${prefix} stop ${number}`,
      ...offset(index * spacingMeters, north),
    };
  });
}

/** The quick trail: 11 caches 60 m apart, west to east; with the default settings it ranks first. */
export const QUICK_TRAIL = chain({
  prefix: 'GCE2B',
  count: 11,
  spacingMeters: 60,
  north: 0,
}).map((cache, index) => {
  if (index === 0) return { ...cache, hint: 'Under the synthetic stone' };
  if (index === 1) return { ...cache, hint: 'Behind the synthetic fence' };
  if (index === 4) return { ...cache, logs: DNF_STREAK_LOGS };
  if (index === 7) return { ...cache, logs: MAINTENANCE_LOGS };
  return cache;
});

/** The quick trail's doubtful caches: two DNFs in a row, and a maintenance request. */
export const DNF_STREAK_CACHE = QUICK_TRAIL[4];
export const MAINTENANCE_CACHE = QUICK_TRAIL[7];

/** The long trail: 14 caches 160 m apart, 2 km north; slower, longer than 5 km and 2 h. */
export const LONG_TRAIL = chain({
  prefix: 'GCE2A',
  count: 14,
  spacingMeters: 160,
  north: 2000,
});

/** Caches the default settings leave out: a mystery, a hard one, and one the file says is found. */
const LEFT_OUT: E2eCache[] = [
  {
    code: 'GCE2M01',
    name: 'E2E mystery',
    ...offset(300, 2050),
    type: 'Unknown Cache',
  },
  { code: 'GCE2D01', name: 'E2E hard one', ...offset(200, -80), difficulty: 4 },
  { code: 'GCE2F01', name: 'E2E found one', ...offset(700, 0), found: true },
];

export const ALL_CACHES = [...QUICK_TRAIL, ...LONG_TRAIL, ...LEFT_OUT];

/** The parking area of the quick trail's first cache, in the additional-waypoints file. */
export const QUICK_TRAIL_PARKING = offset(-40, -30);

function escapeXml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function logEntry(log: { type: string; date: string }, index: number) {
  return `        <groundspeak:log id="${index + 1}">
          <groundspeak:date>${log.date}</groundspeak:date>
          <groundspeak:type>${escapeXml(log.type)}</groundspeak:type>
          <groundspeak:finder id="1">E2E Finder</groundspeak:finder>
          <groundspeak:text encoded="False">Invented log.</groundspeak:text>
        </groundspeak:log>`;
}

function cacheWaypoint(cache: E2eCache) {
  const type = cache.type ?? 'Traditional Cache';
  return `  <wpt lat="${cache.latitude.toFixed(6)}" lon="${cache.longitude.toFixed(6)}">
    <name>${cache.code}</name>
    <desc>${escapeXml(cache.name)} by E2E Owner, ${type}</desc>
    <sym>${cache.found ? 'Geocache Found' : 'Geocache'}</sym>
    <type>Geocache|${type}</type>
    <groundspeak:cache id="1" available="True" archived="False" xmlns:groundspeak="http://www.groundspeak.com/cache/1/0/1">
      <groundspeak:name>${escapeXml(cache.name)}</groundspeak:name>
      <groundspeak:placed_by>E2E Owner</groundspeak:placed_by>
      <groundspeak:type>${type}</groundspeak:type>
      <groundspeak:container>Micro</groundspeak:container>
      <groundspeak:difficulty>${cache.difficulty ?? 1.5}</groundspeak:difficulty>
      <groundspeak:terrain>1.5</groundspeak:terrain>
      <groundspeak:encoded_hints>${escapeXml(cache.hint ?? '')}</groundspeak:encoded_hints>
      <groundspeak:logs>
${(cache.logs ?? ONE_FIND).map(logEntry).join('\n')}
      </groundspeak:logs>
    </groundspeak:cache>
  </wpt>`;
}

function gpxDocument(waypoints: string[]) {
  return `<?xml version="1.0" encoding="utf-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/0" version="1.0" creator="PowerTrailBuddy e2e">
  <name>E2E Pocket Query</name>
${waypoints.join('\n')}
</gpx>
`;
}

/** A Pocket Query's main file: every cache of the fixture, or the ones given. */
export function pocketQueryGpx(caches: readonly E2eCache[] = ALL_CACHES) {
  return gpxDocument(caches.map(cacheWaypoint));
}

/** A Pocket Query's `-wpts.gpx`: the quick trail's parking area. */
function additionalWaypointsGpx() {
  const { latitude, longitude } = QUICK_TRAIL_PARKING;
  return gpxDocument([
    `  <wpt lat="${latitude.toFixed(6)}" lon="${longitude.toFixed(6)}">
    <name>PKE2B01</name>
    <desc>Parking</desc>
    <sym>Parking Area</sym>
    <type>Waypoint|Parking Area</type>
  </wpt>`,
  ]);
}

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** The two files of a Pocket Query download, zipped as geocaching.com delivers them. */
export async function pocketQueryZip(
  name = '9876543_e2e.zip',
): Promise<FilePayload> {
  const zip = new JSZip();
  // Bytes, not strings: JSZip's own encoder splits multi-byte characters at its chunk boundaries.
  zip.file('9876543.gpx', Buffer.from(pocketQueryGpx()));
  zip.file('9876543-wpts.gpx', Buffer.from(additionalWaypointsGpx()));
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  return { name, mimeType: 'application/zip', buffer };
}

/** A plain `.gpx` file. */
export function gpxFile(
  name: string,
  caches: readonly E2eCache[] = ALL_CACHES,
): FilePayload {
  return {
    name,
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(pocketQueryGpx(caches)),
  };
}

/** A file the importer refuses. */
export function notAPocketQuery(): FilePayload {
  return {
    name: 'shopping-list.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('bread, milk'),
  };
}
