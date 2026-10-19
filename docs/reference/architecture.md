# Architecture reference

What exists and how it fits together. Why it is built this way:
[Design decisions](../explanation/design-decisions.md).

## Application

A Next.js App Router **static export** (`output: 'export'`) in `web/`, served
by GitHub Pages under the base path `/PowerTrailBuddy` (`EXPORT_BASE_PATH` in
`web/next.config.ts`; a `PAGES_BASE_URL` without a path, as on a custom
domain, builds for `/`). There is no server runtime, no route handler and no
backend; everything below runs in the browser.

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
| `lib/trails/` | Trail settings and their defaults, geometry, the trail finder and its stages (`filterCaches`, `linkComponents`, `orderPath`, `splitWalks`, `scoreTrail`, `trailShape`, `projection`, `compareCodes`), distances from the user (`nearby.ts`) | other `lib/` |
| `lib/walk/` | Walk state: start, orient, reverse, record, undo, next cache, progress, pace | other `lib/` |
| `lib/export/` | The two downloads: a trail as GPX (`trailGpx.ts`), a walk as Geocaching.com field notes (`fieldNotes.ts`) | other `lib/` |
| `lib/format/` | Display formatting: distances, durations, rates, ratings, coordinates, dates, compass points, decimal input | other `lib/` |
| `lib/navigation/` | Outbound links (`coord.info`, `geo:`, Google Maps walking directions) and the share-target landing (`sharedLaunch.ts`) | other `lib/` |
| `lib/ui-logic/` | Pure decisions behind the UI: trail cards (sort, filter, health), search, presets, heading, parking, bottom-sheet snapping, walk statistics | other `lib/` |
| `data/` | Browser storage: IndexedDB through idb-keyval (`store.ts`), settings validation (`sanitizeSettings.ts`), shared files from Cache Storage (`sharedFiles.ts`), the `localStorage` shim (`browserStorage.ts`) | `lib/` types, `idb-keyval` |
| `components/` | React UI | `lib/`, `data/`, `i18n/` |
| `components/Map/` | The only Leaflet wrapper; owns the tile URL. `content.ts` (pure) turns trails and a walk into markers, lines and badges | `leaflet`, `lib/` |
| `i18n/` | `I18nProvider`, `useI18n`, the pure helpers in `translate.ts`, `de.json`, `en.json` | `data/browserStorage.ts` only |
| top level | `layout.tsx`, `page.tsx`, `env.ts` (base path), `useAppState.ts` with `useMarkActions.ts` and `useWalkActions.ts` (the state and its actions; shared types in `dataCore.ts`), the device hooks (`useGeolocation`, `useCompass`, `useWakeLock`, `useFollow`, `useInstallPrompt`, `useBrowserState`), `useTrails.ts`, `useServiceWorker.ts`, `ServiceWorkerRegistration.tsx`, `globals.css` | anything above |

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
- Logs map to `RecentLog` types (`recentLogs.ts`): `Found it`, `Attended`,
  `Webcam Photo Taken` → found; `Didn't find it` → dnf; `Write note` → note;
  `Needs Maintenance`, `Needs Archived` → maintenance; `Temporarily Disable
  Listing` → disabled; anything else, `Owner Maintenance` and `Enable Listing`
  included (they clear a problem), → other. A log without a readable date is
  dropped; logs of one day keep the file's order.
- `groundspeak:type` maps to `CacheType`: `Traditional Cache` → traditional,
  `Multi-cache` → multi, `Unknown Cache` / `Mystery Cache` → mystery,
  `Letterbox Hybrid` → letterbox, `Wherigo Cache` → wherigo, `Earthcache` →
  earthcache, `Virtual Cache` → virtual, `Webcam Cache` → webcam, anything
  containing `Event` → event, else other.
- The `available` and `archived` attributes are `"True"`/`"False"`, compared
  case-insensitively; missing means available and not archived. `found` is
  `<sym>Geocache Found</sym>`, case-insensitive.

### `lib/geocache/importFiles.ts`

`importFiles(files: readonly File[]): Promise<ImportResult>`,
`ImportResult = { caches: Geocache[]; files: ImportedFile[] }`,
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
- Caches are deduplicated by code; a later file wins. Parking areas from every
  file and entry of one import are matched to caches after that (`parking.ts`:
  a parking area named like the cache code with another two-letter prefix,
  `GC1ABCD` → `PK1ABCD`; the nearest wins), so a `*-wpts.gpx` gives parking to
  the caches of the main file.
- An error no file can cause (no `DOMParser`, for instance) is thrown, not
  reported as a file's problem.

The importer relies on two JSZip details its typings leave out:
`internalStream(type)` and each entry's declared size in
`_data.uncompressedSize`. A JSZip upgrade that changes either fails the limit
tests.

### `lib/geocache/mergeCaches.ts`

`mergeCaches(existing, incoming): Geocache[]` — union by code, incoming wins.
Merging the same import twice changes nothing.

### `lib/trails/types.ts`

`TrailSettings` and `DEFAULT_TRAIL_SETTINGS` ([Configuration](configuration.md#trail-settings)),
and:

```ts
export interface Trail {
  id: string;                  // stable: derived from the codes it contains, never random
  caches: Geocache[];          // in walking order
  pathMeters: number;          // straight line along the order
  returnMeters: number;        // straight line last → first
  walkMeters: number;          // (pathMeters + returnMeters) * detourFactor
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

`findTrails(caches, settings, locallyFound: ReadonlySet<string>): Trail[]`,
fully deterministic:

1. **Filter** (`filterCaches.ts`): type in `settings.cacheTypes`, difficulty
   and terrain at most their maxima, `available && !archived && !found`, and
   not in `locallyFound` (the app passes the caches marked found and the
   ignored ones). The survivors are sorted by code, so input order cannot
   matter.
2. **Link** (`linkComponents.ts`): caches strictly closer than `maxGapMeters`
   are linked; the connected components are the candidate groups, in order of
   their first cache. Neighbours come from a grid spatial index, never all
   pairs: cells `maxGapMeters` tall, and wide by an east–west scale of
   `cos(min(90°, max|lat| + gap/R))`, which never overestimates a distance;
   the column count is rounded down and wraps at ±180°, so the antimeridian is
   no seam. Candidate pairs are confirmed with the haversine distance.
3. **Order** each component as an open path (`orderPath.ts`, on an
   equirectangular projection): start at the cache farthest from the
   component's centre, then nearest neighbour, then 2-opt with free
   endpoints. A move must save more than a relative 1e-9; the work cap is
   20,000,000 move evaluations (a count, never a time limit). Ties, at the
   start and in nearest neighbour, go to the earliest cache in code order.
4. **Split** the ordered path greedily into walks whose `walkMeters` stay at
   or below `maxWalkKilometers`; walks with fewer than `minCaches` caches are
   dropped. This also drops the components smaller than `minCaches`: a small
   group can only split into small walks.
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
`loadImportInfo()`, `saveImportInfo(info)`, `clearAllData()`. A stored walk,
code list or preference in the wrong shape (an older build's included) is
dropped rather than breaking the app; a refused write rejects, and the app
shows a notice.

### `data/sharedFiles.ts`

`takeSharedFiles(): Promise<File[]>` reads, in the order shared, and then
deletes the files the service worker stored in the Cache Storage cache
`powertrailbuddy-shared-files`.

## Storage

Everything the app keeps, all in the user's browser, all per origin.

| Where | Key | Holds | Written by |
| --- | --- | --- | --- |
| IndexedDB database `powertrailbuddy`, object store `state` | `caches` | `Geocache[]`, the merged imports | `data/store.ts` |
| same | `settings` | `TrailSettings` | `data/store.ts` |
| same | `locally-found` | `string[]` of codes marked found in the app (by hand or on a walk) | `data/store.ts` |
| same | `ignored` | `string[]` of codes the user chose to ignore | `data/store.ts` |
| same | `walk` | `WalkState` of the walk in progress | `data/store.ts` |
| same | `preferences` | `{ sort, showOtherCaches }`: the trail list's sort and whether caches outside trails are drawn | `data/store.ts` |
| same | `last-import` | `{ at, cacheCount, fileNames }` of the latest import | `data/store.ts` |
| Cache Storage | `powertrailbuddy-shell-<build id>` | The app shell and hashed assets of one build | `public/sw.js` |
| Cache Storage | `powertrailbuddy-shared-files` | Files received by the share target until the page imports them | `public/sw.js`, emptied by `data/sharedFiles.ts` |
| `localStorage` | `lang` | `de` or `en` | `i18n/I18nProvider.tsx` |

`clearAllData()` removes the seven IndexedDB keys; the language choice and
the caches of the service worker stay. A new stored value is added
to this table in the same change.

## Service worker

`web/public/sw.js`, registered by `useServiceWorker.ts` as
`<base>/sw.js?build=<NEXT_PUBLIC_BUILD_ID>` with scope `<base>/`.

Registration happens only in a production build (`NODE_ENV === 'production'`),
so `next dev` never pins its changing chunks.

- **Precache**: `npm run build` runs `scripts/precache-manifest.mjs` after
  `next build`, which writes `out/precache-manifest.json`: every file under
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
  one shell cache per build. Offline, a navigation is answered by the kept
  page whatever its query, so the share target's `?shared=1` landing opens
  too. On activation it deletes every `powertrailbuddy-shell-*` cache but
  the current one. The prefix spares the shared-files cache and other sites'
  caches on the shared `github.io` origin. Cross-origin requests (map tiles)
  are never intercepted.
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
`connect-src 'self'` — the app can fetch from nowhere else — and `img-src
'self' data: blob: https://tile.openstreetmap.org`, the tile server
`components/Map/` uses (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
`layout.test.ts` asserts both.

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
