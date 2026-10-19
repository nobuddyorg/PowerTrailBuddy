# Configuration reference

## Trail settings

`TrailSettings` in `web/src/app/lib/trails/types.ts`; defaults in
`DEFAULT_TRAIL_SETTINGS`, the user's values in IndexedDB under `settings`
([Architecture](architecture.md#storage)). On load, `data/sanitizeSettings.ts`
drops unknown keys, gives a missing or mistyped field its default, and
clamps (and, where a step is given, rounds) each number into its range; an
empty or unknown cache-type list falls back to the default. The settings
dialog refuses values outside the same ranges before Apply.

| Setting | Default | Range (step) | Meaning |
| --- | --- | --- | --- |
| `cacheTypes` | `['traditional']` | at least one type | Only these types count toward a trail |
| `maxDifficulty` | `2` | 1–5 (0.5) | Highest difficulty rating a trail cache may have |
| `maxTerrain` | `2` | 1–5 (0.5) | Highest terrain rating a trail cache may have |
| `maxGapMeters` | `300` | 10–2000 (1) | Two caches closer than this, straight line, are linked into one group |
| `minCaches` | `10` | 2–1000 (1) | Groups and walks with fewer caches are not trails |
| `maxWalkKilometers` | `10` | 1–100 | Longer chains are split into several walks no longer than this (walking distance, return included) |
| `loopsOnly` | `false` | on or off | Round trips only: each walk is reordered to end next to its start, and kept only if its way back is within `maxReturnMeters` |
| `maxReturnMeters` | `500` | 10–10000 (1) | With `loopsOnly`, the longest walking distance from a walk's last cache back to its first |
| `walkingSpeedKmh` | `4` | 1–10 | Speed for the time estimate |
| `minutesPerCache` | `3` | 1–60 | Time spent at each cache: search, log, back on the path |
| `detourFactor` | `1.3` | 1–3 | Straight-line distance × this ≈ distance on real paths, for every leg without a routed distance |

Presets (`lib/ui-logic/presets.ts`) set only the gap and the trail size:
**Standard** 300 m / 10 caches (the defaults), **Classic power trail** 200 m /
20, **Relaxed** 500 m / 6. Any other pair shows as **Custom**.

Derived per trail ([Architecture](architecture.md#libtrailstypests)):
`walkMeters` = each leg along the order plus the way back, each the routed
walking distance where one is known, else straight line × `detourFactor`
(without walking routes, `(pathMeters + returnMeters) × detourFactor`);
`durationMinutes = walkMeters / 1000 / walkingSpeedKmh × 60 + caches ×
minutesPerCache`; `cachesPerHour = caches / durationMinutes × 60`.
The floor of 1 minute per cache keeps `durationMinutes` positive, and so the
rate finite, even for caches that share one spot.

Caches the Pocket Query marks as found, disabled (`available = false`) or
archived, and caches marked found or ignored in the app, never count.

## Walking routes

A preference, not a trail setting: `walkingRoutes` in IndexedDB under
`preferences`, default `false`, switched in Settings at once (no Apply).

| Constant | Where | Value | Effect |
| --- | --- | --- | --- |
| `BARRIER_FACTOR` | `lib/trails/walkingDistances.ts` | 2 | A routed gap longer than this × `maxGapMeters` × `detourFactor` (or with no path) does not link two caches |
| `BATCH_SIZE` | `lib/routing/planRouting.ts` | 50 caches | Caches per routing request; one request answers every pair among them |
| `BATCH_OVERLAP` | same | 10 caches | Caches each window along a trail shares with the next |
| `REQUEST_INTERVAL_MS` | `lib/routing/requestPolicy.ts` | 1,000 ms | At least this long between two requests (FOSSGIS's policy) |
| `MAX_REQUESTS` | same | 60 | Requests per page load; past it the rest stays estimated until a reload |
| `ROUTER_ORIGIN` | `lib/routing/osrmTable.ts` | `https://routing.openstreetmap.de` | FOSSGIS's OSRM server, foot graph under `/routed-foot` |

## Fixed thresholds in the UI

| Constant | Where | Value | Effect |
| --- | --- | --- | --- |
| `SHORT_WALK_METERS` | `lib/ui-logic/trailCards.ts` | 5,000 m | The "≤ 5 km" filter |
| `QUICK_WALK_MINUTES` | same | 120 min | The "≤ 2 h" filter |
| `NEAR_METERS` | same | 10,000 m | The "Near me" filter: a trail's nearest cache within this |
| `CLOSE_METERS` | `lib/ui-logic/walkStats.ts` | 30 m | On a walk, closer than this shows "You're close" and vibrates once |
| `MAX_RECENT_LOGS` | `lib/geocache/recentLogs.ts` | 5 | Logs kept per cache |

## Import limits

`web/src/app/lib/geocache/importFiles.ts`.

| Limit | Value | Why |
| --- | --- | --- |
| Entries per `.zip` (`MAX_ARCHIVE_ENTRIES`) | 50 | A Pocket Query zip holds two files; anything far beyond that is not one |
| Uncompressed size of a `.zip`'s GPX entries, total (`MAX_IMPORT_BYTES`) | 100 MiB, by the declared sizes and again while inflating | 1,000 caches with logs is a few MB; the limit keeps a hostile archive from exhausting a phone's memory |
| Size of any one imported file | 100 MiB | Refused before it is read |

The service worker's share target has its own limits (`public/sw.js`): at most
20 files and 100 MB in one share, refused whole past either.

## Build and environment variables

| Variable | Where | Effect |
| --- | --- | --- |
| `PAGES_BASE_URL` | `next build` | The deployed site's URL; its path becomes the base path. Unset: `/PowerTrailBuddy` |
| `E2E_COVERAGE_SOURCEMAPS` | `next build`, `npm run e2e` | `true` emits source maps and makes the browser suite collect coverage; never set for the deployed build |
| `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_BUILD_ID` | set by `next.config.ts` | Inlined into the bundle: the base path, and a per-build id that versions the service worker's cache |

There are no secrets and no `.env` file.

## Coverage and mutation thresholds

| Gate | Where | Value |
| --- | --- | --- |
| Unit coverage, global | `web/vitest.config.mts` `GLOBAL_COVERAGE_THRESHOLDS` | 99% statements, branches, functions, lines |
| Unit coverage, per file | same file, `PER_FILE_FLOOR`, over `mutation-targets.mjs` | 100% |
| Unit coverage, what counts | same file, `coverage.include`, `coverage.exclude` | Product code under `src/app/` only; left out: `types.ts`, `*.test-support.*`, the dictionaries, `*.d.ts`, and the glue Playwright verifies (`layout.tsx`, `page.tsx`, `components/Map/index.tsx`). `public/sw.js` is not measured: its tests evaluate the source text with `new Function`, which V8 cannot attribute to the file, so it is mutation-tested instead |
| Mutation targets | `web/mutation-targets.mjs` | `MUTATE_TARGETS`, which also get the per-file coverage floor, plus `MUTATE_ONLY_TARGETS` (`public/sw.js`), mutated without one |
| Mutation score | `web/stryker.config.mjs` `thresholds.break` | 99 — one below 100, so a single new equivalent mutant cannot block unrelated work |
| E2E JS/CSS coverage | `web/e2e/coverage.ts` `COVERAGE_THRESHOLDS` | 88% statements, 74% branches, 88% functions, 88% lines — about 3 points under the first full run (chromium and mobile: 91.1%, 76.9%, 90.9%, 91.4%) |

Every floor is raised by hand when a real run reports a higher number, and
never lowered to make a change fit. `autoUpdate` is off in Vitest.

Stryker runs the unit suite through `web/vitest.mutation.config.mts`, which
leaves out `*.performance.test.ts`: their wall-clock bounds hold for the plain
code, not under Stryker's instrumentation, and a timing assertion kills no
mutant. They run in `npm test` as usual. `vitest.related` is off: no test
imports `public/sw.js` (its tests read it as text, which in Stryker's sandbox
is the instrumented copy), so Vitest's related-file lookup would run none of
them.

## End-to-end tests

[`web/playwright.config.ts`](../../web/playwright.config.ts), specs in
`web/e2e/public/`. Projects: `chromium` (Desktop Chrome), `mobile` (Pixel 7),
`firefox`. The three offline-through-the-worker cases run in the Chromium
projects only (developer-guide.md, "Offline through the service worker").

| Variable | Effect |
| --- | --- |
| _(unset)_ | Serves `web/out` under the base path and tests it |
| `E2E_BASE_URL` | Tests that origin instead; starts no server; `retries: 2` |
| `E2E_PORT` | Local server port, default `4173` |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Launches the `chromium` and `mobile` projects with this Chrome binary, for a machine whose preinstalled Chromium is not the revision Playwright pins |

Every test gets two fixtures automatically: `tiles` answers requests to
`tile.openstreetmap.org` with a blank 1×1 PNG, so no test reaches the real tile
server, and `pageProblems` fails the test on any uncaught error, console
error or Content-Security-Policy violation in the page (a failed tile load
excepted, which only the tile-outage spec causes).
