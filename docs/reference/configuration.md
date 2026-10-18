# Configuration reference

## Trail settings

`TrailSettings` in `web/src/app/lib/trails/types.ts`; defaults in
`DEFAULT_TRAIL_SETTINGS`, the user's values in IndexedDB under `settings`
([Architecture](architecture.md#storage)). A stored value missing a field gets
that field's default.

| Setting | Default | Meaning |
| --- | --- | --- |
| `cacheTypes` | `['traditional']` | Only these types count toward a trail |
| `maxDifficulty` | `2` | Highest difficulty rating (1–5) a trail cache may have |
| `maxTerrain` | `2` | Highest terrain rating (1–5) a trail cache may have |
| `maxGapMeters` | `300` | Two caches closer than this, straight line, are linked into one group |
| `minCaches` | `10` | Groups and walks with fewer caches are not trails |
| `maxWalkKilometers` | `10` | Longer chains are split into several walks no longer than this (walking distance, return included) |
| `walkingSpeedKmh` | `4` | Speed for the time estimate |
| `minutesPerCache` | `3` | Time spent at each cache: search, log, back on the path |
| `detourFactor` | `1.3` | Straight-line distance × this ≈ distance on real paths |

Derived per trail ([Architecture](architecture.md#libtrailstypests)):
`walkMeters = (pathMeters + returnMeters) × detourFactor`;
`durationMinutes = walkMeters / 1000 / walkingSpeedKmh × 60 + caches ×
minutesPerCache`; `cachesPerHour = caches / durationMinutes × 60`.

Caches the Pocket Query marks as found, disabled (`available = false`) or
archived, and caches marked found in the app, never count.

## Import limits

`web/src/app/lib/geocache/importFiles.ts`.

| Limit | Value | Why |
| --- | --- | --- |
| Entries per `.zip` | 50 | A Pocket Query zip holds two files; anything far beyond that is not one |
| Uncompressed size per `.zip`, total | 100 MB | 1,000 caches with logs is a few MB; the limit keeps a hostile archive from exhausting a phone's memory |

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
| Unit coverage, what counts | same file, `coverage.exclude` | Product code only; left out: `types.ts`, `*.test-support.*`, the dictionaries, `*.d.ts`, and the glue Playwright verifies (`layout.tsx`, `page.tsx`, `components/Map/index.tsx`) |
| Mutation score | `web/stryker.config.mjs` `thresholds.break` | 99 — one below 100, so a single new equivalent mutant cannot block unrelated work |
| E2E JS/CSS coverage | `web/e2e/coverage.ts` `COVERAGE_THRESHOLDS` | Not yet set (0): set about 3 points under the first measured run of the finished app |

Every floor is raised by hand when a real run reports a higher number, and
never lowered to make a change fit. `autoUpdate` is off in Vitest.

## End-to-end tests

[`web/playwright.config.ts`](../../web/playwright.config.ts), specs in
`web/e2e/public/`. Projects: `chromium` (Desktop Chrome), `mobile` (Pixel 7),
`firefox`.

| Variable | Effect |
| --- | --- |
| _(unset)_ | Serves `web/out` under the base path and tests it |
| `E2E_BASE_URL` | Tests that origin instead; starts no server; `retries: 2` |
| `E2E_PORT` | Local server port, default `4173` |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Launches the `chromium` and `mobile` projects with this Chrome binary, for a machine whose preinstalled Chromium is not the revision Playwright pins |

Every test gets the `tiles` fixture automatically: requests to
`tile.openstreetmap.org` are answered with a blank 1×1 PNG, so no test reaches
the real tile server.
