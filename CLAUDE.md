# CLAUDE.md

Standing instructions for Claude Code and any other AI assistant working in
this repository. `web/CLAUDE.md` adds Next.js-specific context on top of this
file. Read this file and [TEST_STRATEGY.md](TEST_STRATEGY.md) before writing
anything.

## What this project is

**PowerTrailBuddy** is a mobile-first, installable, bilingual (German/English)
web app that finds geocache **power trails** — chains and clusters of quick
caches — in the user's own Geocaching.com **Pocket Query** files, and guides a
**walking** tour through one. Features: [README.md](README.md). Full docs:
[docs/README.md](docs/README.md).

- **Frontend**: Next.js App Router as a **static export**, React, Tailwind,
  Leaflet, a hand-written service worker. `web/`.
- **Backend**: none. No server, no account, no login, no API of its own.
- **Data**: only files the user imports — a Pocket Query `.zip` or `.gpx`
  files, through a file picker or the Android share sheet (Web Share Target,
  handled by the service worker). Everything is stored in the browser
  (IndexedDB, Cache Storage, `localStorage`). The network requests are
  OpenStreetMap tiles and, only once the user opts in, FOSSGIS's public OSRM
  foot router (`routing.openstreetmap.de`).
- **Distances**: walking only. Straight-line haversine times a detour factor
  by default; with walking routes on, routed foot distances where known, and a
  gap whose walk is far longer than its straight line (a motorway, a river)
  splits a trail.
- **Deploy**: `pages-deploy.yml` builds and publishes to GitHub Pages under
  `/PowerTrailBuddy`, once CI has passed on the merge commit on `main`, then
  runs the browser suite against the live site. No staging.

## Read before you touch

| Area | Read first |
| --- | --- |
| Modules, contracts, data flow, storage keys, service worker | [architecture.md](docs/reference/architecture.md), then [design-decisions.md](docs/explanation/design-decisions.md) |
| Trail settings and their defaults | [configuration.md](docs/reference/configuration.md) |
| Tests: which layer, what may be faked, fixtures | [TEST_STRATEGY.md](TEST_STRATEGY.md) §3–§9, then [developer-guide.md](docs/how-to/developer-guide.md) and [risk-model.md](docs/reference/risk-model.md) |
| Local setup, the pre-PR checklist | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Hard rules

Settled decisions and safety rules. If a task seems to need one reversed, stop
and say so; never work around it quietly. Reasoning lives in
design-decisions.md, not here.

- **Import only.** Data comes from files the user chooses. Never add scraping,
  credential handling, a login to Geocaching.com, or any other unofficial
  access to geocaching.com or its API — its terms of use forbid automated
  access, and the official API is for licensed partners only.
- **Nothing leaves the device unasked.** The one exception is the opt-in
  walking-routes setting (off by default), which sends trail caches'
  coordinates, and nothing else, to `routing.openstreetmap.de`. Never send
  settings, positions, cache data beyond that, or anything else to any server:
  no analytics, no error reporting service, no sync, no geocoding API, no
  other router. Honour FOSSGIS's usage policy: at most one request a second,
  a per-visit cap, attribution and a "fix the map" link. The CSP's
  `connect-src 'self' https://routing.openstreetmap.de` and the browser
  suite's foreign-origin check (strict unless a spec sets `allowRouter`)
  enforce this; never relax either further. OpenStreetMap tiles are the other
  outside request.
- **Synthetic fixtures only.** Test data uses invented cache codes, names and
  coordinates. Never copy a real listing, a real Pocket Query, or a real
  person's data into the repository.
- Pure logic in `src/app/lib/` imports no React, Next, Leaflet, idb-keyval,
  `data/` or `components/`; only `src/app/data/` imports idb-keyval; only
  `src/app/components/Map/` imports Leaflet. dependency-cruiser enforces it.
- Never lower a coverage or mutation threshold (`web/vitest.config.mts`,
  `web/stryker.config.mjs`, `web/e2e/coverage.ts`) or auto-ratchet one. An
  unreachable threshold is a design problem: redesign, or raise it with the
  user.
- No `/* v8 ignore */` or `// Stryker disable`. No `.skip`, ESLint or TS
  suppression without understanding the failure first; the reason goes on the
  same line. No test gaming.
- Never commit to `main`, skip hooks (`--no-verify`), force-push over others'
  commits, or rewrite history on a branch you don't own.
- Never modify `.github/workflows/**`, branch protection, or
  `.pre-commit-config.yaml`'s security hooks unless the user explicitly asks.
- Never run `npm audit fix --force` or a from-scratch `rm -rf node_modules
  package-lock.json && npm install` in `web/`; use targeted `overrides`.
- A package `next build` loads (a PostCSS or Next plugin, a loader,
  TypeScript) goes in `dependencies`, never `devDependencies`: Dependabot
  auto-merges bumps that change only `dev: true` lockfile entries.

## How to work here

- **Smallest necessary change.** Preserve existing behavior unless changing it
  is what was asked. Boy-scout fixes stay inside the function or file you are
  already editing; if something outside it breaks a rule, say so rather than
  widening the diff.
- **When principles collide:** correctness and privacy, then KISS/YAGNI, then
  clean code, then DRY, then SOLID. No abstraction for a requirement nobody
  has; extract on the third occurrence. SOLID means modules, hooks, and
  functions — never classes or a DI container (an `Error` subclass with a code
  is fine).
- **Split by responsibility:** parse and compute in pure functions under
  `src/app/lib/` that take values as parameters and never reach for `window`,
  `fetch`, IndexedDB, the router or `Date.now()`; read and write browser
  storage in `src/app/data/`; render in the component. Hard-to-reach coverage
  or a stubborn mutant means extract the logic, not force the test. New pure
  logic goes on `web/mutation-targets.mjs`; rendering stays off it.
- **Determinism:** trail finding and walk state give the same output for the
  same input — no randomness, no wall clock, no time-boxed search; iteration
  caps are counts.
- **Clean code, as applied here:** intent-revealing names, no abbreviations or
  type prefixes; small functions with guard clauses; zero to two parameters,
  else a named object, never a boolean flag; command-query separation; no
  `null`/`undefined` as a signal where a type or empty collection models it;
  files under ~350 lines (test files under ~600); no dead code; no dependency
  without clear value over what's here, and none that is deprecated or
  unmaintained. Dependencies are fixed by the scaffold; adding one is a
  decision to raise, not a side effect.
- **Comments:** one line, hard cap, only for a non-obvious constraint,
  workaround, invariant, or external behavior — never to narrate code or record
  a decision (that goes in the commit or PR).
- **Fail fast; measure, don't assume.** Surface errors, never swallow them.
  Performance, coverage, and bundle size are numbers a tool prints. Anything
  that compares caches pairwise uses the spatial grid, never all pairs.
- **i18n:** every user-facing string goes through `t('...')` and exists in
  **both** `web/src/app/i18n/de.json` and `en.json` in the same change. German
  is the default locale.
- **Tests:** a UI change gets an E2E case for its journey; a functional change
  gets a unit test asserting behavior, not implementation; parser and geometry
  changes get a property test where one is easy to state. E2E specs reach the
  app only through the page objects in `web/e2e/pages/`. Disagreeing with the
  playbook is fine; departing from it silently is not.
- **Docs sync:** a change to setup, the checklist, architecture, a contract,
  configuration, a design decision, or a testing assumption updates the
  matching `docs/` file (and `CONTRIBUTING.md`/`README.md`) in the same
  change. A change to what the app stores or whom it talks to updates
  architecture.md's storage section and the user guide in the same change.
  TEST_STRATEGY.md stays generic: a PowerTrailBuddy fact landing there is a
  bug — it goes in `docs/` or here.

## Development commands

```bash
cd web && npm install
npm run dev          # http://localhost:3000, served from the root
npm run build        # static export in web/out, base path /PowerTrailBuddy
```

## Definition of done

Not done — no "done", no ready PR, no reported success — until every one of
these is green, from `web/`, in this order (`build` generates `next-env.d.ts`,
which `tsc` and ESLint need):

```bash
E2E_COVERAGE_SOURCEMAPS=true npm run build
npx tsc --noEmit
npx prettier --check .
npm run lint
npm run depcruise         # architectural boundaries
npm run knip              # dead code / unused dependencies, then exports only tests use
npm test -- --coverage
E2E_COVERAGE_SOURCEMAPS=true npm run e2e   # chromium, mobile, firefox
npm run test:mutation     # if you changed code in a file listed in web/mutation-targets.mjs;
                          # comments produce no new mutants (TEST_STRATEGY.md §14, gate scope)
```

`E2E_COVERAGE_SOURCEMAPS=true` on both the build and the suite is what CI's
`e2e` job sets; without it the e2e coverage floor (`web/e2e/coverage.ts`)
never runs. It adds source maps, so it is for test builds only: the deployed
build never sets it.

`prek run --all-files` from the repo root runs the repo-wide hooks (`typos`,
`zizmor`, `actionlint`, `markdownlint`, file hygiene) plus the same web
checks. A partial run is a status update, not a stopping point. If a gate
blocks finishing, say so — never relax the gate.
