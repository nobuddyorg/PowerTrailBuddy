# Developer guide

Recipes for developing and operating PowerTrailBuddy. Local setup and the
pre-PR checklist are in [CONTRIBUTING.md](../../CONTRIBUTING.md); this guide
covers each check in depth, and everything past the checklist.

## Run the checks CI runs, locally

The checklist in [CONTRIBUTING.md](../../CONTRIBUTING.md#before-opening-a-pull-request)
is CI's `build_and_test` and `e2e` jobs step for step; `mutation_test` is
`npm run test:mutation`.

On a pull request, CI's `changes` job skips `build_and_test`, `e2e` and
`mutation_test` unless `web/**`, `ci.yml` or a composite action in
`.github/actions/` changed. Any other path runs only `prek`, so run the
matching checks locally for it. A push to `main` or a dispatch runs
everything, and the deploy waits for that run. A skipped job reports as
passed.

## Where code goes

| You are writing… | It goes in | Tested by |
| --- | --- | --- |
| Parsing, geometry, trail finding, walk state | `web/src/app/lib/` — pure functions, no browser APIs | Unit + property + mutation; add the file to `mutation-targets.mjs` |
| Reading or writing browser storage | `web/src/app/data/` | Unit with a fake store |
| UI | `web/src/app/components/<Name>/` | Component tests; one E2E case per journey |
| Anything touching Leaflet | `web/src/app/components/Map/` only | E2E (the wrapper is excluded from unit coverage) |
| Service worker behavior | `web/public/sw.js`, as small named functions | `web/src/app/sw*.test.ts`, evaluating them from source; mutation (no coverage floor) |
| User-facing text | `t('area.key')` + both `de.json` and `en.json` | `parity.test.ts` |

The boundaries are checked by `npm run depcruise`
([Architecture](../reference/architecture.md#modules)). A new dependency is a
decision to raise, not a side effect of a change.

## Write a unit test

Vitest, files beside the code as `*.test.ts(x)`. The default environment is
Node; a test that needs the DOM starts with `// @vitest-environment jsdom`.
Fixtures shared by several test files go in `*.test-support.ts`, which
coverage treats as test code.

- **Fixtures are synthetic.** Build GPX documents in the test (a small
  builder in a `*.test-support.ts` is the usual shape) with invented codes
  such as `GC0TEST1`, invented names and coordinates. Never paste a real
  listing or a real Pocket Query.
- **Size limits are tested with generated input**, not committed large files.
- **No randomness, no clock** in code under test; pure logic takes what it
  needs as parameters.
- `it.each` is fine for repeated cases: the separator plugin in
  `vitest.mutation.config.mts` makes Stryker's per-test filter match the
  suite paths Vitest joins with `>`, `it.each` titles included.

```bash
cd web
npm test                         # once
npx vitest                       # watch
npm test -- --coverage           # with the thresholds CI enforces
```

## Replay a property-test failure

Parsers and geometry carry fast-check properties beside their example tests
(`*.property.test.ts`). Every run uses one fixed seed from `vitest.setup.ts`,
so a failure reproduces as it stands. A failure prints its seed and a shrunk
counterexample; to replay a different seed, or explore new inputs:

```bash
cd web
FC_SEED=12345 npx vitest run property
```

## Run mutation testing

```bash
cd web
npm run test:mutation
```

Stryker mutates exactly the files in [`mutation-targets.mjs`](../../web/mutation-targets.mjs):
`MUTATE_TARGETS`, which `vitest.config.mts` also reads for its per-file 100%
coverage floors, so the two cannot drift, and `MUTATE_ONLY_TARGETS`
(`public/sw.js`, which V8 coverage cannot measure). It runs the suite through `vitest.mutation.config.mts`,
which leaves out the `*.performance.test.ts` timing tests. There is no `Stryker disable` or `/* v8 ignore */` in
`src/`; a survivor is a missing assertion or dead code to delete.

Runs are incremental: Stryker keeps every mutant's result in
`web/reports/stryker-incremental.json` and reruns only mutants whose code or
covering tests changed. It cannot see a change anywhere else — a module a
target imports, a test helper, a dependency — so after one of those, or to
reproduce `main`, rerun everything:

```bash
npm run test:mutation -- --force
```

CI runs this on every PR, restoring `main`'s incremental file; `main` itself
always runs with `--force`. Locally, the report is
`web/reports/mutation/index.html`.

## Run the end-to-end suite

```bash
cd web
npm run build   # the suite drives the built export, not the dev server
npm run e2e
```

Playwright starts and stops the server itself, serving `out/` **under the base
path** (`/PowerTrailBuddy`) the way GitHub Pages does —
`scripts/serve-export.mjs` builds the directory for that, reading the path
from `next.config.ts`. An export served at `/` 404s on nearly everything.

```bash
npx playwright test --ui               # pick tests, watch, step through
npx playwright test --project=mobile   # the Pixel 7 viewport only
npx playwright show-report             # after a failed run
```

If the machine has a preinstalled Chromium that is not the revision the pinned
`@playwright/test` expects, point the `chromium` and `mobile` projects at it
instead of downloading browsers:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome npm run e2e -- --project=chromium --project=mobile
```

The same suite runs against the deployed site after every release:

```bash
E2E_BASE_URL="https://<owner>.github.io/PowerTrailBuddy/" npm run e2e
```

With `E2E_BASE_URL` set it starts no server. That run catches what only
production has: a wrong base path, an icon that 404s, a stale CDN asset. The
app has no account and writes nothing outside the browser, so every spec is
safe to run there.

### How a spec addresses the app

No spec names a selector of its own. `e2e/pages/` holds one page object per
screen, `createPageTree(page)` in `e2e/pages/index.ts` collects them, and
`e2e/fixture.ts` hands that tree to every test as the `on` fixture, so a test
starts `async ({ on, page })` and reads as the journey it is.
[TEST_STRATEGY.md](../../TEST_STRATEGY.md) §9 has the shape and the rules. A
new screen adds `e2e/pages/<screen>.ts` exporting `init<Screen>(page)` and a
getter in the tree.

Elements are found by `data-testid` (the project's default: most text is
translated), or by role where the test is about what a user perceives.
Leaflet's own DOM is reached only inside `e2e/pages/map.ts`. The grep that
keeps this honest should return only `html`, `body`, `meta` and `link`
assertions:

```bash
grep -rn 'getByTestId\|getByRole\|locator(' web/e2e --include=*.spec.ts
```

### Faked tiles, import fixtures, device APIs

- The `tiles` fixture (automatic) answers every `tile.openstreetmap.org`
  request with a blank PNG, on the browser context, which in Chromium also
  routes the requests the service worker makes to keep tiles. Playwright
  routes none of a Firefox worker's own requests, so the Firefox project
  blocks the service worker (`serviceWorkers: 'block'` in
  `playwright.config.ts`) and only `service-worker.spec.ts` and
  `share-target.spec.ts`, which test the worker, allow it. There the
  project also resolves `tile.openstreetmap.org` to the machine itself
  (`network.dns.localDomains`): the worker's tile fetches fail and the map
  gets the worker's `504`, but no test can reach the real tile server. The `foreignRequests` fixture (automatic) fails
  every test whose pages or service worker contacted any other origin, so
  each journey (import, map, walk, share, export) checks that nothing leaves
  the device. Only a spec that sets `test.use({ allowRouter: true })`
  (`routes.spec.ts`) may reach `routing.openstreetmap.de`, and it answers
  those requests itself with `fakeRouter(page, { barrierLongitude })`: 1.2 ×
  the straight line, no path across the barrier, a 503 with `failing`.
- The `pageProblems` fixture (automatic) fails a test on any uncaught error,
  console error or CSP violation in the page, so a rejected background
  promise cannot hide behind a passing assertion. CSP violations are read
  from the `securitypolicyviolation` event, because Chromium reports a
  blocked `eval` only there while Firefox logs it to the console. A tile the
  server failed to send is its outage, not the app's error: messages at a
  tile's URL, or naming one (Firefox's CORS error for a failed tile), are
  left out. `failMapTiles` in `e2e/helpers.ts` takes the
  tile server down for the one spec that checks the app without it.
- Import fixtures are generated, not committed: `e2e/pocketQuery.ts` writes a
  synthetic Pocket Query (two trails, three caches the default settings leave
  out, a parking area in the `-wpts.gpx`) and zips it with JSZip, as bytes.
  Generated rather than checked in as TEST_STRATEGY §8 suggests, so the specs
  know every code and coordinate they assert on (`QUICK_TRAIL`, `LONG_TRAIL`,
  `offset()`). The page objects set the files on the import input.
- Geolocation: `placeDevice(context, position)` sets the position, then
  grants the permission (in that order: Firefox's emulation never hands a
  later fix to a watch whose first try failed), `moveDevice` walks it somewhere else, `denyLocation` refuses
  the permission for the fallback (both engines deny every permission an empty
  grant leaves out).
- Downloads (`Export GPX`, `Export field notes`) are read with
  `downloadedBytes(download)`; the specs assert the file name and content.
- The share sheet cannot be driven; `share-target.spec.ts` submits a
  `multipart/form-data` form to `share-target/` from inside the page once the
  service worker controls it, the navigation Android's share sheet makes (a
  `fetch()` POST is not one, and Firefox refuses the worker's redirect for
  it), and lands where the redirect leads.
- Offline through the service worker runs in Chromium only
  (`SW_ONLY_IN_CHROMIUM` in `e2e/helpers.ts`): Playwright drives service
  workers there alone, and its Firefox offline mode fails a navigation
  before the worker sees it. The worker's offline logic is unit-tested from
  source in `sw*.test.ts` for every engine.
- `offerInstall(page)` fires the `beforeinstallprompt` event Chromium sends
  once the install criteria hold, which no headless run does by itself.
- `bottom-sheet.spec.ts` sets a phone-sized viewport for every project, as the
  sheet exists only below the wide layout.

### The e2e coverage report

With `E2E_COVERAGE_SOURCEMAPS=true` for both `npm run build` and
`npm run e2e`, the Chromium projects collect JS/CSS coverage through
Playwright's `page.coverage` and write `web/coverage-e2e/`. CI's `e2e` job does
this, and fails below the floor in `e2e/coverage.ts`
([Configuration](../reference/configuration.md#coverage-and-mutation-thresholds)).
To find what no journey reaches, read the function coverage per file in
`web/coverage-e2e/index.html`, not the line coverage.

## Why every build writes the precache manifest

The service worker installs only with the whole app: it fetches
`out/precache-manifest.json` and every asset it lists, and an install that
misses one fails, leaving the old worker (or none) in place. That failure is
silent: the page works online, only offline support is gone. So the manifest
is written by a Next.js adapter (`scripts/precache-manifest.mjs`, set as
`adapterPath` in `next.config.ts`) at the end of `next build` itself, and a
plain `npx next build` writes it as surely as `npm run build`. The build
prints `precache-manifest.json: <n> assets`.

`scripts/serve-export.mjs`, which serves the export for `npm run e2e` locally
and in CI, refuses to start when the manifest is missing or leaves out a file
under `out/_next/static`, and says why. An export built some other way never
reaches a browser test that would pass online and hide the gap.

## Update the screenshots

`docs/images/` holds the screenshots in the README and the user guide, taken
from the built export with the bundled sample data, in English, on a desktop
and a Pixel 7 viewport. After a visible UI change:

```bash
cd web
npm run build
npm run screenshots   # scripts/docs-screenshots.mjs; PLAYWRIGHT_CHROMIUM_EXECUTABLE as for the e2e suite
```

The script serves the export itself, blocks the service worker and answers
every tile request with a plain tile, so it contacts no other server and the
map background stays empty. Commit the changed images.

## Deploy to GitHub Pages

`pages-deploy.yml` deploys `main`'s tip once CI has passed on it: `gate` →
`build` (with `PAGES_BASE_URL` from the Pages settings) → `deploy` →
`smoke_test` (the e2e suite against the live URL). It also runs hourly to pick
up a green tip a dispatch-triggered CI run produced, and on
`workflow_dispatch`.

For a fork: enable **Settings → Pages → Source: GitHub Actions**, and protect
`main` with the CI jobs as required checks. Nothing else needs configuring:
there are no secrets. The repository name sets the default base path
(`repository` in `web/next.config.ts`); on a custom domain the deploy reads
the empty path from the Pages settings.

## Roll back a bad deploy

Revert the offending commit on `main` through a PR. CI runs, and the deploy
publishes the reverted bundle. Users' data is in their browsers and unaffected
by a deploy; a change to what `data/store.ts` writes must still read what the
previous build wrote.

## Review a dependency bump

Dependabot opens the bumps; CI runs every check on them. A few dependencies
carry an assumption the suite cannot re-check by itself, so a bump of one of
them gets a look:

- **`jszip`**: `lib/geocache/importFiles.ts` enforces the size limits through
  `internalStream()` and `_data.uncompressedSize`, which JSZip's typings leave
  out. `importFiles.jszip.test.ts` fails with a message naming issue #12 when
  either is gone. A major version is the moment to read the sizes from the
  zip's central directory instead.
- **`@playwright/test`**: the offline cases run in Chromium only
  (`SW_ONLY_IN_CHROMIUM` in `e2e/helpers.ts`), because Playwright drives
  service workers only there, its Firefox offline mode fails a navigation
  before the worker sees it, and Firefox routes none of a worker's own
  requests (so the Firefox project also resolves the tile host to the machine
  itself). Read the release notes for Firefox service-worker support; once it
  lands, drop the condition and run the three cases in Firefox.
- **`next`**: read `node_modules/next/dist/docs/` for the changed version
  (`web/AGENTS.md`), and check that the precache adapter (`adapterPath` in
  `next.config.ts`) still runs: the build prints `precache-manifest.json: <n>
  assets`, and `scripts/serve-export.mjs` refuses an export without it.

## Bump a pinned CI tool

Actions are pinned by commit SHA with the tag in a comment; Dependabot bumps
them weekly. The gitleaks binary in `ci.yml`'s `prek` job is pinned by
version and checksum: take the new release's
`gitleaks_<version>_checksums.txt` entry for `linux_x64` and update both
values, and the hook's `rev` in `.pre-commit-config.yaml` to the same
version.
