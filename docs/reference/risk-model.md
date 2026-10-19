# Risk model

[TEST_STRATEGY.md](../../TEST_STRATEGY.md) §4 instantiated for
PowerTrailBuddy. Status is what the suite covers today; update a row when a
test lands or an incident happens.

| Risk | Cost | Cheapest meaningful test | Where | Status |
| --- | --- | --- | --- | --- |
| Parser misreads a valid variant (namespace 1/0 vs 1/0/1, GSAK/Locus/c:geo/Cachly exports) | Caches silently missing | Unit, one synthetic fixture per variant; property: generated caches read back in every shape | `lib/geocache/parseGpx*.test.ts` | covered |
| Parser accepts garbage (invalid coordinates, unknown type, bad D/T) | `NaN` poisoning every distance | Unit + property + mutation | `lib/geocache/parseGpx*.test.ts` | covered |
| Hostile or huge zip (entry count, uncompressed size, a lying size header) | Tab crash on a phone | Unit with generated archives at and past each limit | `lib/geocache/importFiles.test.ts` | covered |
| A Mac-made zip with `__MACOSX/._*.gpx` metadata | Whole archive refused | Unit with AppleDouble entries beside the GPX | `lib/geocache/importFiles.test.ts` | covered |
| One bad file in a batch import | Whole import lost | Unit: the others import, the bad one reports its error; browser: the summary names it | `lib/geocache/importFiles.test.ts`, `e2e/public/import.spec.ts` | covered |
| Re-import duplicates or loses caches | Wrong counts, lost updates | Unit + property: idempotent, incoming wins; browser: same zip twice | `lib/geocache/mergeCaches.test.ts`, `e2e/public/import.spec.ts` | covered |
| A cache archived, disabled or found online since stays after a fresh import (the query leaves it out, so nothing updates it) | A walk leads to a cache that is gone | None yet: the merge is a union by contract; the user guide says to ignore it or delete the data | — | open (needs a contract decision) |
| Wrong distance or bearing | Every trail metric wrong | Unit with known answers + property (symmetry, triangle inequality) | `lib/trails/geo*.test.ts` | covered |
| Trail finder links or orders wrongly | Product's core claim false | Unit with known-answer fixtures + property (grid linking equals all-pairs) + mutation | `lib/trails/*.test.ts` | covered |
| Non-determinism in trail finding | Results change between runs | Property: shuffled input → same output | `lib/trails/findTrails.property.test.ts` | covered |
| O(n²) or 2-opt blow-up at 10,000 caches | App unusable on a big import | Unit on a generated 10,000-cache input with a generous time bound | `lib/trails/*.performance.test.ts` | covered |
| Walk state loses or double-counts an outcome | Wrong progress, wrong field notes | Unit + property against a plain model + mutation; browser: found/DNF/skip/undo and reload | `lib/walk/walk*.test.ts`, `e2e/public/walk.spec.ts` | covered |
| Stored data from an older build in another shape | Crash, `undefined` limits, a walk that cannot resume | Unit on every load with old-shaped and garbage values | `data/store.test.ts`, `data/sanitizeSettings.test.ts` | covered |
| Exports in a shape the receiving tool rejects (field notes, GPX) | Logs lost, a trail that will not open in a navigation app | Unit + property (GPX reads back through the importer); browser: file name and content of each download | `lib/export/*.test.ts`, `e2e/public/trails.spec.ts`, `e2e/public/walk.spec.ts` | covered |
| Share target stores nothing, or files in the wrong order | Android entry point silently broken | Unit on `sharedFiles.ts`; unit on the worker's handler from source; browser POST to the share target | `data/sharedFiles.test.ts`, `sw.test.ts`, `e2e/public/share-target.spec.ts` | covered |
| A refused share lands silently | The user thinks the import worked | Unit on the landing with no files; browser: an empty share shows the notice | `useAppState.test.tsx`, `e2e/public/share-target.spec.ts` | covered |
| New build deletes the shared-files cache | A share in flight lost | Unit on the worker's cache cleanup; browser: a new worker spares it | `sw.test.ts`, `e2e/public/service-worker.spec.ts` | covered |
| Base path, manifest, icons, worker scope wrong after deploy | Site broken or not installable | Browser suite locally and post-deploy | `e2e/public/smoke.spec.ts`, `pwa.spec.ts`, `service-worker.spec.ts` | covered |
| No app offline, or an offline shell missing its logo, icons or lazily loaded map | The app fails mid-walk with no signal | Unit on the worker's install precache and request classes; browser: offline after a single visit, map included, and offline with trails | `sw.test.ts`, `e2e/public/service-worker.spec.ts` | covered |
| A share received offline lands on the browser's error page | The shared Pocket Query is lost in the field | Unit: offline navigation with a query gets the kept page; browser: form share with the server unreachable | `sw.test.ts`, `e2e/public/share-target.spec.ts` | covered |
| Another website posts a file to the share target | Caches injected or overwritten without the user knowing | Unit: a share waits for Import, Cancel drops it; browser: confirm and cancel | `useAppState.test.tsx`, `components/SharedImportDialog/SharedImportDialog.test.tsx`, `e2e/public/share-target.spec.ts` | covered |
| Data leaves the device | Privacy breach | CSP source test + browser foreign-origin check on every test (automatic fixture, pages and worker); tiles answered by the fake, never the network | `layout.test.ts`, `e2e/fixture.ts` | covered |
| Tile server down | Blank map | Browser test with failing tiles: the list and the walk still work | `e2e/public/trails.spec.ts` | covered |
| Geolocation denied or absent, or allowed later | Walk view crashes, or stays without a position until a reload | Component test with the API faked away; unit: a new watch after a refusal and on a permission change; browser with the permission denied, then granted | `components/WalkView/WalkView.test.tsx`, `useGeolocation.test.ts`, `e2e/public/walk.spec.ts` | covered |
| A bundled dependency evaluates code at load (`Function()`/`eval`) that the CSP blocks (incident: jszip's Node entry pulled in `stream`/`util` polyfills; Firefox logged it, Chromium stayed silent) | A browser-specific console error, or a feature broken where the blocked code matters | `next.config.ts` aliases jszip to its browser build; browser: every journey fails on a CSP violation in any engine | `next.config.ts`, `e2e/helpers.ts` | covered |
| Map torn down in the middle of a zoom animation (incident, found by the browser suite's console-error check) | An uncaught error on starting or leaving a walk | Browser: every journey fails on an uncaught error | `components/Map/index.tsx`, `e2e/fixture.ts` | covered |
| Untrusted cache names rendered as markup | Script injection from a crafted GPX | Component test with markup in a name; map labels built as text nodes | `components/CacheDetails/CacheDetails.test.tsx`, `components/Map/elements.test.ts` | covered |
| Missing translation | Keys shown to users | `parity.test.ts`; browser: no raw key in an unsupported locale | `i18n/parity.test.ts`, `e2e/public/i18n.spec.ts` | covered |
| Accessibility regression | Unusable with screen reader or keyboard | jsx-a11y strict + axe on representative states (first run, list, trail, cache, both dialogs, walk, summary) | `eslint.config.mjs`, `e2e/public/accessibility.spec.ts` | covered (no known regression, not compliance) |
