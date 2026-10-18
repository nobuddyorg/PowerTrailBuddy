# Risk model

[TEST_STRATEGY.md](../../TEST_STRATEGY.md) §4 instantiated for
PowerTrailBuddy. Status is what the suite covers today; update a row when a
test lands or an incident happens.

| Risk | Cost | Cheapest meaningful test | Where | Status |
| --- | --- | --- | --- | --- |
| Parser misreads a valid variant (namespace 1/0 vs 1/0/1, GSAK/Locus/c:geo/Cachly exports) | Caches silently missing | Unit, one synthetic fixture per variant | `lib/geocache/parseGpx.test.ts` | not covered |
| Parser accepts garbage (invalid coordinates, unknown type, bad D/T) | `NaN` poisoning every distance | Unit + property + mutation | `lib/geocache/parseGpx*.test.ts` | not covered |
| Hostile or huge zip (entry count, uncompressed size) | Tab crash on a phone | Unit with generated archives at and past each limit | `lib/geocache/importFiles.test.ts` | not covered |
| One bad file in a batch import | Whole import lost | Unit: the others import, the bad one reports its error | `lib/geocache/importFiles.test.ts` | not covered |
| Re-import duplicates or loses caches | Wrong counts, lost updates | Unit + property: idempotent, incoming wins | `lib/geocache/mergeCaches.test.ts` | not covered |
| Wrong distance or bearing | Every trail metric wrong | Unit with known answers + property (symmetry, triangle inequality) | `lib/trails/geo.test.ts` | not covered |
| Trail finder links or orders wrongly | Product's core claim false | Unit with known-answer fixtures + property + mutation | `lib/trails/findTrails*.test.ts` | not covered |
| Non-determinism in trail finding | Results change between runs | Property: shuffled input → same output | `lib/trails/findTrails*.test.ts` | not covered |
| O(n²) or 2-opt blow-up at 10,000 caches | App unusable on a big import | Unit on a generated 10,000-cache input with a generous time bound | `lib/trails/findTrails*.test.ts` | not covered |
| Walk state loses or double-counts an outcome | Wrong progress | Unit + mutation | `lib/walk/walk.test.ts` | not covered |
| Stored settings from an older build lack a field | Crash or `undefined` limits | Unit on `loadSettings` with an old-shaped value | `data/store.test.ts` | not covered |
| Share target stores nothing, or files in the wrong order | Android entry point silently broken | Unit on `sharedFiles.ts`; unit on the worker's handler from source; browser POST to the share target | `data/sharedFiles.test.ts`, `sw.test.ts`, `e2e/public/` | partly (`sharedFiles.ts`) |
| New build deletes the shared-files cache | A share in flight lost | Unit on the worker's cache cleanup | `sw.test.ts` | covered |
| Base path, manifest, worker scope wrong after deploy | Site broken or not installable | Browser suite locally and post-deploy | `e2e/public/smoke.spec.ts` | partly |
| Data leaves the device | Privacy breach | CSP source test + browser foreign-origin check | `layout.test.ts`, `e2e/public/smoke.spec.ts` | covered |
| Tile server down | Blank map | Browser test with failing tiles; the list still works | `e2e/public/` | not covered |
| Geolocation denied or absent | Walk view crashes | Component test with the API faked away | `components/` | not covered |
| Untrusted cache names rendered as markup | Script injection from a crafted GPX | Component test with markup in a name | `components/` | not covered |
| Missing translation | Keys shown to users | `parity.test.ts` | `i18n/parity.test.ts` | covered |
| Accessibility regression | Unusable with screen reader or keyboard | jsx-a11y strict + axe in the browser suite | `eslint.config.mjs`, `e2e/axe.ts` | partly |
