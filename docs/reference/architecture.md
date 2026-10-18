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
| `lib/geocache/` | Cache types, the GPX parser, the file importer (zip and gpx), the merge | `jszip`, other `lib/` |
| `lib/trails/` | Trail settings and their defaults, geometry, the trail finder | other `lib/` |
| `lib/walk/` | Walk state: start, record an outcome, next cache, progress | other `lib/` |
| `data/` | Browser storage: IndexedDB through idb-keyval (`store.ts`), shared files from Cache Storage (`sharedFiles.ts`), the `localStorage` shim (`browserStorage.ts`) | `lib/` types, `idb-keyval` |
| `components/` | React UI | `lib/`, `data/`, `i18n/` |
| `components/Map/` | The only Leaflet wrapper; owns the tile URL | `leaflet`, `lib/` |
| `i18n/` | `I18nProvider`, `useI18n`, the pure helpers in `translate.ts`, `de.json`, `en.json` | `data/browserStorage.ts` only |
| top level | `layout.tsx`, `page.tsx`, `env.ts` (base path), `useServiceWorker.ts`, `ServiceWorkerRegistration.tsx`, `globals.css` | anything above |

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
}
```

### `lib/geocache/parseGpx.ts`

`parseGpx(xml: string): ParsedGpx`, `ParsedGpx = { caches: Geocache[];
skippedWaypoints: number }`. Throws `GpxParseError` (`code: 'not-xml' |
'not-gpx'`) for unusable input.

- Accepts the Groundspeak cache extension in namespaces `…/cache/1/0` and
  `…/cache/1/0/1`, matched by local name, so a new minor version does not
  break the import.
- A waypoint without a cache element (an additional waypoint) is skipped and
  counted; so is one with invalid coordinates.
- `groundspeak:type` maps to `CacheType`: `Traditional Cache` → traditional,
  `Multi-cache` → multi, `Unknown Cache` / `Mystery Cache` → mystery,
  `Letterbox Hybrid` → letterbox, `Wherigo Cache` → wherigo, `Earthcache` →
  earthcache, `Virtual Cache` → virtual, `Webcam Cache` → webcam, anything
  containing `Event` → event, else other.
- The `available` and `archived` attributes are `"True"`/`"False"`, compared
  case-insensitively.

### `lib/geocache/importFiles.ts`

`importFiles(files: readonly File[]): Promise<ImportResult>`,
`ImportResult = { caches: Geocache[]; files: ImportedFile[] }`,
`ImportedFile = { name: string; cacheCount: number; error?: 'unsupported' |
'unreadable' | 'too-large' }`.

- `.zip` through jszip: every `.gpx` entry inside is parsed, other entries
  ignored. An archive with more than **50 entries** or more than **100 MB**
  uncompressed in total is refused as `too-large`, checked before inflating.
- `.gpx` parsed directly; anything else is `unsupported`.
- Caches are deduplicated by code; a later file wins.

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

1. **Filter**: type in `settings.cacheTypes`, difficulty and terrain at most
   their maxima, `available && !archived && !found`, and not in
   `locallyFound`.
2. **Link**: caches closer than `maxGapMeters` are linked; the connected
   components are the candidate groups. Neighbours are found through a grid
   spatial index (cells of `maxGapMeters`), never all pairs, so 10,000 caches
   stay fast.
3. **Drop** components with fewer than `minCaches` caches.
4. **Order** each component as an open path: start at an extreme point,
   nearest neighbour, then 2-opt with free endpoints under a fixed iteration
   cap (a count, never a time limit).
5. **Split** the ordered path greedily into walks whose `walkMeters` stay at
   or below `maxWalkKilometers`; walks with fewer than `minCaches` caches are
   dropped.
6. **Score** each walk (the `Trail` fields above).
7. **Sort** by `cachesPerHour` descending, then cache count descending, then
   `id`.

### `lib/walk/walk.ts`

`WalkState = { trailId: string; codes: string[]; outcomes: Record<string,
'found' | 'skipped'> }`; `startWalk(trail)`, `recordOutcome(state, code,
outcome)` (pure, returns a new state), `nextCode(state)` (the first code
without an outcome, `undefined` when done), `walkProgress(state)` →
`{ done, total, found }`.

### `data/store.ts`

The only module importing idb-keyval: `loadCaches()`, `saveCaches(caches)`,
`loadSettings()` (stored values over `DEFAULT_TRAIL_SETTINGS`, so a setting
added later gets its default), `saveSettings(settings)`, `loadLocallyFound()`,
`saveLocallyFound(codes)`, `loadWalk()`, `saveWalk(state | undefined)`,
`clearAllData()`.

### `data/sharedFiles.ts`

`takeSharedFiles(): Promise<File[]>` reads, in the order shared, and then
deletes the files the service worker stored in the Cache Storage cache
`powertrailbuddy-shared-files`.

## Storage

Everything the app keeps, all in the user's browser, all per origin.

| Where | Key | Holds | Written by |
| --- | --- | --- | --- |
| IndexedDB, idb-keyval's default store (`keyval-store`) | `caches` | `Geocache[]`, the merged imports | `data/store.ts` |
| same | `settings` | `TrailSettings` | `data/store.ts` |
| same | `locally-found` | `string[]` of codes marked found in the app | `data/store.ts` |
| same | `walk` | `WalkState` of the walk in progress | `data/store.ts` |
| Cache Storage | `powertrailbuddy-shell-<build id>` | The app shell and hashed assets of one build | `public/sw.js` |
| Cache Storage | `powertrailbuddy-shared-files` | Files received by the share target until the page imports them | `public/sw.js`, emptied by `data/sharedFiles.ts` |
| `localStorage` | `lang` | `de` or `en` | `i18n/I18nProvider.tsx` |

`clearAllData()` removes the four IndexedDB keys. A new stored value is added
to this table in the same change.

## Service worker

`web/public/sw.js`, registered by `useServiceWorker.ts` as
`<base>/sw.js?build=<NEXT_PUBLIC_BUILD_ID>` with scope `<base>/`.

- **Caching**: cache-first for hashed `/_next/static/**`, network-first for
  navigations and the manifest, one shell cache per build; on activation it
  deletes every `powertrailbuddy-shell-*` cache but the current one. The
  prefix spares the shared-files cache and other sites' caches on the shared
  `github.io` origin. Cross-origin requests (map tiles) are never intercepted.
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
  calls `takeSharedFiles()`, imports them, and removes the query parameter.

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
