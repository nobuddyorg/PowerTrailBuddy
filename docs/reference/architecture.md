# Architecture reference

What exists and how it fits together. Why it is built this way:
[Design decisions](../explanation/design-decisions.md).

## Application

A Next.js App Router **static export** (`output: 'export'`) in `web/`, served
by GitHub Pages under the base path `/PowerTrailBuddy` (`EXPORT_BASE_PATH` in
`web/next.config.ts`; a `PAGES_BASE_URL` without a path, as on a custom
domain, builds for `/`). There is no server runtime, no route handler and no
backend; everything below runs in the browser. The only servers it talks to
are the OpenStreetMap tile server and, once the user turns walking routes on,
FOSSGIS's OSRM foot router ([Outside requests](#outside-requests)).

```text
 file picker ─┐                                        ┌─> IndexedDB (data/store.ts)
              ├─> importFiles ─> parseGpx ─> mergeCaches ┤
 share sheet ─┘   (lib/geocache)                       └─> findTrails ─> trail list ─> map
   │                                                        (lib/trails)        │
   └─ sw.js stores files in Cache Storage                                      walk state
      └─ data/sharedFiles.ts takes them on load                                 (lib/walk)
```

## Modules

All paths relative to `web/src/app/`.

| Directory | Holds | May import |
| --- | --- | --- |
| `lib/geocache/` | Cache types, the GPX parser, recent logs (`recentLogs.ts`), parking areas (`parking.ts`), cache health (`health.ts`), the file importer (zip and gpx), the merge | `jszip`, other `lib/` |
| `lib/trails/` | Trail settings and their defaults, geometry, the trail finder and its stages (`filterCaches`, `linkComponents`, `orderPath`, `splitWalks`, `scoreTrail`, `trailShape`, `projection`, `compareCodes`), routed walking distances and barriers (`walkingDistances.ts`), distances from the user (`nearby.ts`) | other `lib/` |
| `lib/routing/` | Which caches still need walking distances (`planRouting.ts`), the OSRM table request and its answer (`osrmTable.ts`) | other `lib/` |
| `lib/walk/` | Walk state: start, orient, reverse, record, undo, next cache, progress, pace | other `lib/` |
| `lib/export/` | The two downloads: a trail as GPX (`trailGpx.ts`), a walk as Geocaching.com field notes (`fieldNotes.ts`) | other `lib/` |
| `lib/format/` | Display formatting: distances, durations, rates, ratings, coordinates, dates, compass points, decimal input | other `lib/` |
| `lib/navigation/` | Outbound links (`coord.info`, `geo:`, Google Maps walking directions) and the share-target landing (`sharedLaunch.ts`) | other `lib/` |
| `lib/ui-logic/` | Pure decisions behind the UI: trail cards (sort, filter, health), search, presets, heading, parking, bottom-sheet snapping, walk statistics | other `lib/` |
| `data/` | Browser storage: IndexedDB through idb-keyval (`store.ts`), settings validation (`sanitizeSettings.ts`), shared files from Cache Storage (`sharedFiles.ts`), the `localStorage` shim (`browserStorage.ts`); the routing server's `fetch` (`walkingRoutes.ts`) | `lib/`, `idb-keyval` |
| `components/` | React UI | `lib/`, `data/`, `i18n/` |
| `components/Map/` | The only Leaflet wrapper; owns the tile URL. `content.ts` (pure) turns trails and a walk into markers, lines and badges | `leaflet`, `lib/` |
| `i18n/` | `I18nProvider`, `useI18n`, the pure helpers in `translate.ts`, `de.json`, `en.json` | `data/browserStorage.ts` only |
| top level | `layout.tsx`, `page.tsx`, `env.ts` (base path), `useAppState.ts` with `useMarkActions.ts` and `useWalkActions.ts` (the state and its actions; shared types in `dataCore.ts`), the device hooks (`useGeolocation`, `useCompass`, `useWakeLock`, `useFollow`, `useInstallPrompt`, `useBrowserState`), `useTrails.ts`, `useWalkingDistances.ts` (fetches and keeps routed distances while walking routes are on), `useServiceWorker.ts`, `ServiceWorkerRegistration.tsx`, `globals.css` | anything above |

`web/public/sw.js` is the service worker (a plain script, no bundler);
`web/public/site.webmanifest` the manifest.

The boundaries are enforced by `web/.dependency-cruiser.mjs`
(`lib-is-pure`, `storage-behind-data-layer`, `leaflet-behind-map`,
`data-layer-no-components`, `i18n-no-app-deps`, `e2e-is-black-box`,
`scripts-are-standalone`, `app-bundle-no-node-tooling`, `no-circular`,
`no-orphans`, `not-to-unresolvable`) and, for static imports in the editor,
by ESLint's `no-restricted-imports`.

## Contracts

The signatures every module is built against. A change to one is called out
in the commit and updates this section.

### `lib/geocache/types.ts`

```ts
export type CacheType = 'traditional' | 'multi' | 'mystery' | 'letterbox' | 'wherigo'
  | 'earthcache' | 'virtual' | 'webcam' | 'event' | 'other';
export interface Coordinates { latitude: number; longitude: number }
export interface Geocache extends Coordinates {
  code: string;          // e.g. GC1ABCD or OC1234, upper-case, unique identity
  name: string;
  type: CacheType;
  difficulty: number;    // 1..5 in 0.5 steps
  terrain: number;       // 1..5 in 0.5 steps
  container: string;     // as given, e.g. 'Micro', 'Small', 'Not chosen'
  available: boolean;    // false when temporarily disabled
  archived: boolean;
  found: boolean;        // found by the PQ owner according to the file (<sym>Geocache Found</sym>)
  placedBy: string;      // '' when absent
  hint: string;          // groundspeak:encoded_hints, '' when none
  recentLogs: RecentLog[];   // { type: 'found' | 'dnf' | 'note' | 'maintenance' | 'disabled' | 'other'; date: 'YYYY-MM-DD' }, newest first, at most 5
  sources: string[];         // the queries that delivered it (sourceName of each GPX file), sorted; [] from parseGpx and for a cache stored before sources were kept
  parking?: Coordinates;     // the nearest 'Parking Area' additional waypoint of this cache in the same import
}
```

### `lib/geocache/parseGpx.ts`

`parseGpx(xml: string): ParsedGpx`, `ParsedGpx = { caches: Geocache[];
skippedWaypoints: number; parkingAreas: ParkingArea[] }`. Throws
`GpxParseError` (`code: 'not-xml' | 'not-gpx'`) for unusable input: any XML
parser error is `not-xml`, a root other than `gpx` is `not-gpx`. Whitespace
before the XML declaration is tolerated.

- Accepts the Groundspeak cache extension in namespaces `…/cache/1/0` and
  `…/cache/1/0/1`, matched by local name and namespace prefix, directly under
  `<wpt>` (Pocket Query) or inside `<extensions>` (GSAK, GPX 1.1); `oc:` and
  `gsak:` extras are ignored.
- The code is the waypoint's `<name>`, trimmed and upper-cased; the name falls
  back to the code, a missing container is `''`.
- Coordinates and ratings must be plain decimals (no exponent, hex or comma):
  coordinates within ±90/±180, ratings 1–5 in half steps. A waypoint failing
  that, with no code, or without a cache element (an additional waypoint) is
  skipped and counted.
- An additional waypoint whose `<sym>` or `<type>` is `Parking Area` (or
  `Waypoint|Parking Area`) is returned in `parkingAreas`.
- Logs map to `RecentLog` types (`recentLogs.ts`, compared
  case-insensitively, `’` read as `'`) as in the table below. A log without a
  readable date is dropped; logs of one day keep the file's order.
- `groundspeak:type` maps to `CacheType`: `Traditional Cache` → traditional,
  `Multi-cache` → multi, `Unknown Cache` / `Mystery Cache` → mystery,
  `Letterbox Hybrid` → letterbox, `Wherigo Cache` → wherigo, `Earthcache` →
  earthcache, `Virtual Cache` → virtual, `Webcam Cache` → webcam, anything
  containing `Event` → event, else other.
- The `available` and `archived` attributes are `"True"`/`"False"`, compared
  case-insensitively; missing means available and not archived. `found` is
  `<sym>Geocache Found</sym>`, case-insensitive.

| `groundspeak:type` of a log | `RecentLog` type | Effect on `cacheHealth` as the newest log |
| --- | --- | --- |
| `Found it`, `Attended`, `Webcam Photo Taken` | found | none |
| `Didn't find it` | dnf | two in a row: `dnf-streak` |
| `Write note` | note | none |
| `Needs Maintenance`, `Needs Archived` | maintenance | `needs-maintenance` |
| `Temporarily Disable Listing` | disabled | none (`available` decides `disabled`) |
| `Owner Maintenance`, `Enable Listing`, `Update Coordinates`, `Post Reviewer Note` | other | none: the owner or a reviewer acted, which clears an earlier warning |
| `Publish Listing`, `Retract Listing`, `Archive`, `Permanently Archived`, `Unarchive`, `Will Attend`, `Announcement`, anything else | other | none (`archived` keeps an archived cache out of every trail) |

### `lib/geocache/importFiles.ts`

`importFiles(files: readonly File[]): Promise<ImportResult>`,
`ImportResult = { caches: Geocache[]; files: ImportedFile[]; sources:
string[] }`,
`ImportedFile = { name: string; cacheCount: number; error?: 'unsupported' |
'unreadable' | 'too-large' }`.

Files are read one after another; the extension decides, case-insensitively.

- Any single file over **100 MiB** (`MAX_IMPORT_BYTES`) is `too-large` before
  it is read; a file the browser cannot read is `unreadable`.
- `.zip` through jszip: every `.gpx` entry that is not a directory is parsed,
  except the AppleDouble metadata a Mac adds (anything under `__MACOSX/`, any
  name starting `._`); other entries, nested zips included, are ignored, and an
  archive with no `.gpx` entry is `unsupported`. More than **50 entries**
  (`MAX_ARCHIVE_ENTRIES`), or GPX entries whose declared uncompressed sizes
  add up to more than 100 MiB, is `too-large`, checked before inflating. Each
  entry is inflated as a stream and stopped as it grows past its declared
  size (`too-large`); one that ends short of it, or a corrupt archive, is
  `unreadable`. An archive is all or nothing: one GPX entry that is not XML
  makes it `unreadable`.
- `.gpx` parsed directly: not XML is `unreadable`, XML that is not GPX is
  `unsupported`.
- A file without an extension is sniffed: `PK\x03\x04` is a zip, a leading
  `<` (after a BOM and whitespace, within the first 1 KB) a GPX. Any other
  extension (`.xml`, `.kml`, …) is `unsupported`.
- Each GPX document read, a file or a zip entry, is a query named
  `sourceName(fileName)`: the base name without folder, `.gpx` extension or the
  number in brackets a browser adds to a repeated download, trimmed and
  lower-cased (`26071826 (1).gpx` → `26071826`). A Pocket Query's zip holds
  `<id>.gpx`, so the entry's name, not the zip's, names it. Its caches carry
  that name in `sources`; `ImportResult.sources` lists every document that
  parsed, sorted and once each, a `-wpts.gpx` or one without caches included.
  A refused file or archive names none.
- Caches are deduplicated by code; a later file wins, with the sources of
  every file that had the cache. Parking areas from every
  file and entry of one import are matched to caches after that (`parking.ts`:
  a parking area named like the cache code with another two-letter prefix,
  `GC1ABCD` → `PK1ABCD`; the nearest wins), so a `*-wpts.gpx` gives parking to
  the caches of the main file.
- An error no file can cause (no `DOMParser`, for instance) is thrown, not
  reported as a file's problem.

The importer relies on two JSZip details its typings leave out:
`internalStream(type)` and each entry's declared size in
`_data.uncompressedSize`. A JSZip upgrade that changes either fails
`importFiles.jszip.test.ts`, with a message pointing here, before the limit
tests.

### `lib/geocache/mergeCaches.ts`

`mergeCaches(existing, { caches, sources }): { caches: Geocache[];
removedCount: number }` — union by code, incoming wins, in place, new ones
appended. A query in `sources` replaces its earlier caches: an existing cache
loses each of its sources the import read, and is dropped once none is left
and the import does not list it, so a cache another query still lists stays.
A cache without sources (stored before they were kept) always stays.
`removedCount` is the number dropped. Merging the same import twice changes
nothing. `sourcesOf(...lists)` (also used by the importer) is every query
named in the lists, once each, in code-unit order (`compareCodes`). The marks of a dropped cache (`locally-found`, `ignored`) stay: they
are codes, harmless without their cache, and apply again if a query brings
it back.

### `lib/trails/types.ts`

`TrailSettings` and `DEFAULT_TRAIL_SETTINGS` ([Configuration](configuration.md#trail-settings)),
and:

```ts
export interface Trail {
  id: string;                  // stable: derived from the codes it contains, never random
  caches: Geocache[];          // in walking order
  pathMeters: number;          // straight line along the order
  returnMeters: number;        // straight line last → first
  walkMeters: number;          // each leg and the way back: routed where known, else straight * detourFactor
  durationMinutes: number;     // walkMeters at walkingSpeedKmh + caches * minutesPerCache
  cachesPerHour: number;
  shape: 'line' | 'area';      // eigenvalue ratio of the projected coordinates; line when elongated
  center: Coordinates;
}
```

### `lib/trails/geo.ts`

`distanceMeters(a, b)` (haversine, R = 6371008.8 m) and `bearingDegrees(a, b)`
(initial bearing, 0..360).

### `lib/trails/findTrails.ts`

`findTrails(caches, { settings, locallyFound: ReadonlySet<string>,
walkingDistances?: WalkingDistances }): Trail[]`, fully deterministic for the
same input. A leg's walking metres (`legMetersFor`) are the routed distance
where `walkingDistances` has one, else the straight line times
`detourFactor`; without routed distances the result is exactly the
straight-line one. `orderedGroups(caches, input)` exposes stages 1–3 for the
routing planner.

1. **Filter** (`filterCaches.ts`): type in `settings.cacheTypes`, difficulty
   and terrain at most their maxima, `available && !archived && !found`, and
   not in `locallyFound` (the app passes the caches marked found and the
   ignored ones). The survivors are sorted by code, so input order cannot
   matter. `exclusionReasons(cache, criteria)` names what leaves one cache
   out (`type`, `difficulty`, `terrain`, `disabled`, `archived`, `found`,
   `marked`), empty for a candidate; the cache view shows them.
2. **Link** (`linkComponents.ts`): caches strictly closer than `maxGapMeters`
   are linked; the connected components are the candidate groups, in order of
   their first cache. Neighbours come from a grid spatial index, never all
   pairs: cells `maxGapMeters` tall, and wide by an east–west scale of
   `cos(min(90°, max|lat| + gap/R))`, which never overestimates a distance;
   the column count is rounded down and wraps at ±180°, so the antimeridian is
   no seam. Candidate pairs are confirmed with the haversine distance, then
   with `isWalkableGap`: a pair whose leg is longer than
   `BARRIER_FACTOR` (2) × `maxGapMeters` × `detourFactor`, which only a
   routed distance can be (Infinity where no path joins them), is a barrier
   and does not link (`linkComponentsWhere`).
3. **Order** each component as an open path (`orderPath.ts`, on an
   equirectangular projection): start at the cache farthest from the
   component's centre, then nearest neighbour, then 2-opt with free
   endpoints. A move must save more than a relative 1e-9; the work cap is
   20,000,000 move evaluations (a count, never a time limit). Ties, at the
   start and in nearest neighbour, go to the earliest cache in code order.
4. **Split** the ordered path greedily into walks whose legs plus way back
   stay at or below `maxWalkKilometers`; walks with fewer than `minCaches` caches are
   dropped. This also drops the components smaller than `minCaches`: a small
   group can only split into small walks.
   With `loopsOnly` (`roundTrips.ts`), each walk is then closed into a round
   trip: 2-opt over the closed tour from the walk's order (`shortenLoop` in
   `orderPath.ts`; the first cache stays put, the same work cap), kept only
   if it walks shorter than the order it started from, then started after its
   shortest leg, the earliest on a tie, so that leg is the way back. Walks
   whose way back is longer than `maxReturnMeters` are dropped. A round trip
   is never longer than its walk, so it stays within `maxWalkKilometers`.
5. **Score** each walk (`scoreTrail.ts`, the `Trail` fields above). The id is
   the smallest code (plain character order, `compareCodes.ts`) + `-` + the
   cache count, the same whichever way the trail is walked. The shape is
   `line` when the PCA eigenvalue ratio of the projected caches is below
   `LINE_EIGENVALUE_RATIO` = 0.1, else `area`.
6. **Sort** by `cachesPerHour` descending, then cache count descending, then
   `id`.

It assumes cache codes are unique, as `Geocache.code` and `mergeCaches`
promise. Settings are clamped to sane ranges on load (`data/sanitizeSettings.ts`,
[Configuration](configuration.md#trail-settings)), so it never sees a zero
speed or gap.

### `lib/trails/walkingDistances.ts`

`WalkingDistances = ReadonlyMap<string, number>`: routed walking metres by
`pairKey(a, b)` (both caches as `code@lat,lon` to six decimals, sorted, so the
same either way round and new for a moved cache), `Infinity` where no path
joins them. `legMetersFor(distances, detourFactor)`, `isWalkableGap(legMeters,
{ maxGapMeters, detourFactor })`, `BARRIER_FACTOR` = 2,
`NO_WALKING_DISTANCES`.

### `lib/routing/`

- `routingBatches(caches, input)` (`planRouting.ts`): the requests still
  needed, each up to `BATCH_SIZE` (50) caches. First, windows along each
  group of at least `minCaches` in walking order, overlapping by
  `BATCH_OVERLAP` (10), that hold an unrouted pair close enough to link
  (straight line under `maxGapMeters`, found with the spatial grid), so a
  cache marked found or added shifts the windows without asking again for
  pairs only a window ever held. Once there are none,
  every leg of every trail, the way back first, that is still unrouted, two
  caches each, packed into batches: without `loopsOnly` only ways back are
  left by then; a round trip can also join caches no window held together. Empty once everything is known.
- `tableUrl(caches)` and `parseTable(caches, body)` (`osrmTable.ts`):
  `https://routing.openstreetmap.de/routed-foot/table/v1/foot/<lon,lat;…>?annotations=distance`
  (six decimals); every pair of the answer's metre matrix, the longer of
  there and back, `Infinity` if either is `null`. Anything but `code: 'Ok'`
  with a square table of the batch's size throws.

### `lib/trails/nearby.ts`

`nearestEnd(trail, position)` → `{ code, meters }`, the first or last cache,
whichever is closer (the first on a tie); `distanceToTrail(trail, position)`,
straight-line metres to its nearest cache.

### `lib/walk/walk.ts`

```ts
export type WalkOutcome = 'found' | 'dnf' | 'skipped';
export interface WalkState {
  trailId: string;
  codes: string[];             // walking order; caches with an outcome are kept in front
  startedAt: string;           // ISO date-time
  outcomes: Record<string, { outcome: WalkOutcome; at: string }>;
  history: string[];           // codes with an outcome, oldest first; undo takes the last
}
```

All pure, time passed in as an ISO string: `startWalk(trail, at)`;
`orientWalk(state, code)` (start the open part at `code`: reversed when it is
the last open cache, else rotated); `reverseWalk(state)` (the open caches the
other way round); `recordOutcome(state, code, outcome, at)` (a later outcome
replaces an earlier one; a code outside the walk is ignored);
`undoLast(state)`; `nextCode(state)` (the first code without an outcome,
`undefined` when done); `walkProgress(state)` → `{ done, total, found, dnf }`;
`walkPace(state, now)` → `{ elapsedMinutes, cachesPerHour }`. Recording
`found` also marks the cache found in the app (`useWalkActions.ts`), and undo
takes that back.

### `lib/export/`

- `buildTrailGpx(trail, title)`: GPX 1.1 with one waypoint per cache in
  walking order, the parking areas as `PK…` waypoints, and a route through
  the caches; text XML-escaped, characters XML cannot carry dropped,
  coordinates to six decimals. Saved as `powertrail-<rank>.gpx`.
- `buildFieldNotes(entries)`: Geocaching.com's drafts format,
  `geocache_visits.txt`: UTF-16LE with a byte order mark, CRLF lines of
  `<code>,<YYYY-MM-DDTHH:MMZ>,<Found it|Didn't find it>,""`, UTC, oldest
  first. Skipped caches are left out.

### `lib/geocache/health.ts`

`cacheHealth(cache)` → `'ok' | 'disabled' | 'dnf-streak' |
'needs-maintenance'`: disabled when not available, a streak when the two
newest logs are both DNFs, needing maintenance when the newest log asks for
it.

### `data/store.ts`

The only module importing idb-keyval: `loadCaches()`, `saveCaches(caches)`,
`loadSettings()` (through `sanitizeSettings`: unknown keys dropped, missing
ones defaulted, numbers clamped and rounded), `saveSettings(settings)`,
`loadLocallyFound()`, `saveLocallyFound(codes)`, `loadIgnored()`,
`saveIgnored(codes)`, `loadWalk()`, `saveWalk(state | undefined)`,
`loadPreferences()` (over `DEFAULT_PREFERENCES`), `savePreferences(p)`,
`loadImportInfo()`, `saveImportInfo(info)`, `loadWalkingDistances()` (only
string keys with non-negative or infinite metres), `saveWalkingDistances(map)`,
`clearAllData()`. A stored walk,
code list or preference in the wrong shape (an older build's included) is
dropped rather than breaking the app; a refused write rejects, and the app
shows a notice.

### `data/walkingRoutes.ts` and `useWalkingDistances.ts`

`fetchWalkingDistances(caches, signal)` fetches `tableUrl(caches)` and
returns `parseTable`'s entries; a non-OK status or a bad answer rejects.
`useWalkingDistances({ caches, settings, locallyFound, enabled })` loads the
stored distances, then while `enabled` asks for `routingBatches(...)[0]`,
one request at a time and at least a second apart, at most `MAX_REQUESTS`
(60) per page load, merges each answer and adds it to the stored ones in one
transaction (`addWalkingDistances`, so another tab's answers stay), and returns
`{ walkingDistances, check }`. `walkingDistances` is empty while off.
`check` is `off`, `checking` (with the batches left), `done`, `limited` (the
cap was reached) or `failed` (a request, a read or a write failed; turning it
off and on tries again). A request is keyed by its caches and places, not by
the array, and once sent it is answered and used even if the input changes;
only turning routes off or leaving the page aborts it.

### `data/sharedFiles.ts`

`takeSharedFiles(): Promise<File[]>` reads, in the order shared, and then
deletes the files the service worker stored in the Cache Storage cache
`powertrailbuddy-shared-files`.

## Storage

Everything the app keeps, all in the user's browser, all per origin.

| Where | Key | Holds | Written by |
| --- | --- | --- | --- |
| IndexedDB database `powertrailbuddy`, object store `state` | `caches` | `Geocache[]`, the merged imports, each with the queries that delivered it (`sources`; read as `[]` when missing or not a list of strings, as from a build before them) | `data/store.ts` |
| same | `settings` | `TrailSettings` | `data/store.ts` |
| same | `locally-found` | `string[]` of codes marked found in the app (by hand or on a walk) | `data/store.ts` |
| same | `ignored` | `string[]` of codes the user chose to ignore | `data/store.ts` |
| same | `walk` | `WalkState` of the walk in progress | `data/store.ts` |
| same | `preferences` | `{ sort, showOtherCaches, walkingRoutes }`: the trail list's sort, whether caches outside trails are drawn, whether walking routes are on | `data/store.ts` |
| same | `last-import` | `{ at, cacheCount, fileNames }` of the latest import | `data/store.ts` |
| same | `walking-distances` | `Map<string, number>` of routed walking metres by cache pair (`Infinity` where no path) | `data/store.ts` |
| Cache Storage | `powertrailbuddy-shell-<build id>` | The app shell and hashed assets of one build | `public/sw.js` |
| Cache Storage | `powertrailbuddy-shared-files` | Files received by the share target until the page imports them | `public/sw.js`, emptied by `data/sharedFiles.ts` |
| Cache Storage | `powertrailbuddy-tiles` | Up to 5,000 OpenStreetMap tiles the map showed, each with the time it was kept | `public/sw.js` |
| `localStorage` | `lang` | `de` or `en` | `i18n/I18nProvider.tsx` |

`clearAllData()` removes the eight IndexedDB keys; the language choice and
the caches of the service worker stay. A new stored value is added
to this table in the same change.

## Service worker

`web/public/sw.js`, registered by `useServiceWorker.ts` as
`<base>/sw.js?build=<NEXT_PUBLIC_BUILD_ID>` with scope `<base>/`.

Registration happens only in a production build (`NODE_ENV === 'production'`),
so `next dev` never pins its changing chunks.

- **Precache**: `scripts/precache-manifest.mjs` is a Next.js adapter
  (`adapterPath` in `next.config.ts`) whose `onBuildComplete` runs once
  `next build` has written the export, so every build writes
  `out/precache-manifest.json`: every file under
  `_next/static/` (source maps left out), the lazily loaded map chunk and
  Leaflet's images included. On `install` the worker fetches that list and
  adds `<base>/`, the shell files below and every listed asset to its build's
  cache, all revalidated (`cache: 'no-cache'`) so an old build's page or list
  never slips in. Only then does it take over (`skipWaiting`); if any file is
  missing, the install fails and the old worker and its cache stay. So the
  app opens offline after a single visit, and after each deploy.
- **Caching**: cache-first for hashed `/_next/static/**`, network-first for
  navigations and the files every page links by URL (the manifest,
  `logo.svg`, `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`),
  one shell cache per build. Network-first waits `NETWORK_TIMEOUT_MS` (3 s)
  for an answer; offline, or past that on a weak signal, the request is
  answered by the kept page whatever its query, so the share target's
  `?shared=1` landing opens too, and a late answer still updates the kept
  copy. With nothing kept it waits for the network after all. On activation
  it deletes every `powertrailbuddy-shell-*` cache but the current one. The
  prefix spares the shared-files and tile caches and other sites' caches on
  the shared `github.io` origin.
- **Map tiles**: a GET of `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
  (the map loads them with CORS, `crossOrigin` in `components/Map/`, so the
  response is readable) is answered cache-first from
  `powertrailbuddy-tiles`. A tile kept for less than `MAX_TILE_AGE_MS`
  (7 days, stamped in the kept copy's `x-powertrailbuddy-kept-at` header) is
  served without a request; an older one is fetched again, and still served
  when the network fails or refuses. A fetched tile is kept, and the cache
  then trimmed to `MAX_TILES` (5,000) entries, oldest first (putting a tile
  again moves it to the end). Offline with nothing kept, the answer is a
  `504`, never a rejected fetch. Only tiles the map asked for are kept;
  nothing is fetched in advance (the OpenStreetMap tile usage policy forbids
  bulk downloads). Every other cross-origin request, the routing server
  included, is never intercepted.
- **Share target**: the manifest declares

  ```json
  "share_target": {
    "action": "share-target/",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{ "name": "files", "accept": [".gpx", ".zip", "application/gpx+xml",
        "application/zip", "application/x-zip-compressed", "application/xml",
        "text/xml", "application/octet-stream"] }]
    }
  }
  ```

  (`action` relative to the manifest, so `<base>/share-target/`). The worker
  intercepts that POST, stores each file in `powertrailbuddy-shared-files` at
  `<base>/shared-file/<index>/<encodeURIComponent(name)>` with its content
  type, and answers `303` to `<base>/?shared=1`. The page sees `shared=1`,
  removes the query parameter and calls `takeSharedFiles()`, which empties
  the cache. It then names the files and imports them only once the user
  taps **Import**; **Cancel** drops them. Any website can post a form to the
  share target, and the worker cannot tell such a post from a real share, so
  nothing shared is imported without that tap.
- **Share limits**: text fields sent along are ignored. More than **20 files**
  or more than **100 MB** in total is refused whole, never trimmed. A share
  replaces an earlier one the page never took. A file name that a URL would
  resolve away (`.`, `..`, empty) is stored as `shared-<index>`. If a write
  fails, the whole cache is dropped, so nothing is half-stored. An unreadable,
  over-limit or failed share stores nothing but still redirects to
  `?shared=1`; the page then shows "no file arrived" (`share-empty`).

## Content security policy

A `<meta http-equiv>` in `layout.tsx` (GitHub Pages sends no headers):
`connect-src 'self' https://routing.openstreetmap.de` — the app can fetch
from nowhere else — and `img-src 'self' data: blob:
https://tile.openstreetmap.org`, the tile server `components/Map/` uses
(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`). `layout.test.ts` asserts
both.

## Outside requests

| To | What it learns | When |
| --- | --- | --- |
| `tile.openstreetmap.org` | The map area on screen | Whenever the map shows an area whose tiles are not kept, or kept for more than a week |
| `routing.openstreetmap.de` (FOSSGIS OSRM, foot) | Coordinates of caches in candidate trails, in batches of 50 | Only with walking routes on (Settings, off by default); at most one request a second and 60 a page load; never a pair already stored |

Nothing else (settings, positions, logs, names, codes) leaves the device. The
route status beside the trail list shows FOSSGIS's attribution and the
OpenStreetMap "fix the map" link its usage policy asks for. The browser suite
fails on any other origin; only `e2e/public/routes.spec.ts` sets
`allowRouter`, and fakes the router.

## i18n

German (`de`, default) and English (`en`): `web/src/app/i18n/de.json`,
`en.json`. The language is a stored choice (`lang` in `localStorage`), else the
browser's, else German; `pickLanguage()` in `i18n/translate.ts` and
`LANG_INIT_SCRIPT` in `layout.tsx` decide alike, so `<html lang>` is right
before first paint. `t(key, values)` fills `{name}` placeholders;
`tCount(key, { count })` picks `key_one` for a count of one. `parity.test.ts`
fails on a key missing from either file, on the files declaring different
keys, and on a key nothing references.

## CI/CD

`.github/workflows/ci.yml` on every PR and push to `main`:

| Job | Runs |
| --- | --- |
| `prek` | Repo-wide hooks: file hygiene, typos, gitleaks (history), zizmor, actionlint, markdownlint, lockfile-lint |
| `changes` | Path filter; a push to `main` or a dispatch forces every job |
| `build_and_test` | `npm run build`, `tsc`, Prettier, ESLint, dependency-cruiser, Knip, `npm test -- --coverage` |
| `e2e` | Builds the export with source maps and runs Playwright (chromium, mobile, firefox) against it under the base path, with e2e coverage |
| `mutation_test` | Stryker over `web/mutation-targets.mjs`, incremental on PRs, full on `main` |

`.github/workflows/pages-deploy.yml` runs once CI has passed on `main`'s tip:
`gate` (the commit is main's tip and CI passed on it) → `build` → `deploy`
(GitHub Pages) → `smoke_test` (the same Playwright suite against the live
URL, `retries: 2`). No secrets beyond the Pages deployment token.
