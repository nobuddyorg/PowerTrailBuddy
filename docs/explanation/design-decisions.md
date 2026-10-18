# Design decisions

Why things are the way they are, where reading the code once would not tell
you. For _what_ exists, see the [Architecture reference](../reference/architecture.md).

## Why a PWA instead of a native app

The app has to run on the phone in your hand while you walk, take a file from
the e-mail app, and show a map. An installable progressive web app does all
three on Android (the Web Share Target puts it in the share sheet once
installed) and the first and third on iOS, from one codebase, with no store
review, no signing keys, and free hosting on GitHub Pages. A native app would
add a second toolchain per platform for the one thing a PWA cannot do on iOS:
receive a shared file. On iOS the **Import** button covers that.

## Why import only — no scraping, no API

Geocaching.com's terms of use forbid automated access to the site (scrapers,
bots, anything that logs in on the user's behalf), and its official API is
available only to licensed partner applications, not to a hobby project. A
**Pocket Query** is the sanctioned way for a Premium member to take their own
search results away as a file, and every major geocaching tool (GSAK, Locus,
c:geo, Cachly) reads and writes the same GPX format. So the app reads files
the user downloaded and nothing else: no credentials ever pass through it,
nothing can break when the site changes its HTML, and there is nothing to
rate-limit or ban. This is a hard rule in [CLAUDE.md](../../CLAUDE.md), not a
v1 shortcut.

The same rule decides how a walk is logged: the app never logs anything on
the user's behalf. It writes the finds and DNFs as **field notes**
(`geocache_visits.txt`), the format geocaching.com's own **Drafts** upload
reads, and the user uploads the file themselves. A trail leaves the app the
same way, as a GPX file for another navigation app.

## Why e-mail or download, and the 1,000-cache ceiling

A Pocket Query returns at most 1,000 caches. Results up to 500 caches are also
e-mailed as an attachment; larger ones are only offered as a download on the
Pocket Queries page. The app therefore takes both routes the same way — a
`.zip` or `.gpx` from the file picker or the share sheet — and merges several
imports, so an area larger than one query is covered by several neighbouring
queries. The user guide recommends Traditional-only queries: power trails are
made of Traditionals, and a smaller file imports faster on a phone.

## Why everything stays in the browser

There is no account to protect and no server to breach: the imported caches,
the settings, the caches marked found and the walk in progress live in
IndexedDB (through idb-keyval, the smallest wrapper that does the job), the
language in `localStorage`. Losing the data costs a re-import, never more. The
privacy guarantee is enforced, not promised: the CSP's `connect-src 'self'`
gives the bundle no other origin to send to, and the browser suite fails on
any request to another origin. Only map tiles come from outside, and a tile
URL reveals only the area being viewed.

## Why walking only, and straight lines times a detour factor

The app plans walks, not drives: power trails along forest paths and field
tracks are what it is for. Real walking routes would need a routing service
(sending the user's area and caches to a third party, against the privacy
rule) or shipping a routing graph (far too large for a static site). A
straight-line distance multiplied by a **detour factor** (default 1.3, a
common rule of thumb for footpaths) is accurate enough to rank trails and
estimate time, stays private, and is computed instantly. The user can change
the factor in settings.

## Why connected components on a grid instead of DBSCAN

A power trail is "caches each within a short walk of the next". That is
exactly a connected component of the graph that links caches closer than
`maxGapMeters`, which has one parameter the user understands ("largest gap")
instead of DBSCAN's two (radius and density) whose interplay nobody can
predict. Components need no noise handling: a lone cache is a component of
one and is dropped by `minCaches`. Neighbours are found through a uniform grid
of cells `maxGapMeters` wide — each cache compares only with the 3×3 cells
around it — so linking is near-linear and 10,000 caches stay fast on a phone,
where all-pairs would be 50 million distance computations.

## Why an open path, 2-opt, and a greedy split

A trail is walked once, start to end, so each component is ordered as an
**open path**: start at an extreme point (an end of the chain), extend by
nearest neighbour, then improve with **2-opt with free endpoints** (reverse
segments while that shortens the path). Nearest neighbour alone leaves
crossings that 2-opt removes; anything heavier (Lin–Kernighan, exact TSP)
buys little for chains of tens to hundreds of caches. The improvement loop has
a fixed iteration cap — a count, never a time limit — so the result is
deterministic and testable. Long chains are then **split greedily** along the
order into walks that fit `maxWalkKilometers` including the walk back to the
start, which is how people actually walk long trails: one section per outing.

## Why trails are sorted by caches per hour

The point of a power trail is a high find rate for the time spent. Caches per
hour (walking time plus a fixed time per cache) ranks a dense short loop above
a long sparse one, and ties go to the larger trail, then to the stable `id`,
so the list never reshuffles between runs.

## Why German is the default locale

The project and most of its first users are German-speaking geocachers, as in
CollectionBuddy. English is complete, chosen automatically for an English
browser, and switchable; every string exists in both dictionaries, enforced
by the parity test.

## Why a Next.js static export

To share one toolchain, one set of conventions and one test strategy with
CollectionBuddy: Next.js App Router with `output: 'export'`, React, Tailwind,
Vitest, Playwright, Stryker, the same lint and architecture checks, deployed
the same way to GitHub Pages under a base path. A static export has no server
runtime, which is exactly this app's shape; nothing Next.js does at request
time is needed.

## Why the service worker is hand-written

The worker has three small jobs — cache the shell per build, delete old
builds' caches, receive shared files — and each is a few lines of the Cache
API. A generated worker (Workbox and friends) would add a build plugin and a
configuration layer larger than the worker itself; the one thing it needs
from the build, the list of hashed assets to precache, is a short script that
`npm run build` runs after `next build`. Its decision functions are
kept as small named functions so `sw.test.ts` can extract and test them from
the source text; shell caches are prefixed `powertrailbuddy-shell-` so the
cleanup can never delete the `powertrailbuddy-shared-files` cache a share is
waiting in.

## Why there is only a light theme

The map is most of the screen, and OpenStreetMap's standard tiles are light.
A dark header, panel and bottom sheet around a bright map read as two apps
glued together and make the map look glaring, while dark tiles would mean a
second tile server, against the one-outside-request rule. So `globals.css`
defines one light palette (forest green for trails and actions, orange for the
walk's current target), `layout.tsx` declares `color-scheme: light` and one
`theme-color`, and nothing reacts to `prefers-color-scheme`.

## Why mutation testing is scoped to a list of files

The value of the app is in pure logic — the parser, the geometry, the trail
finder, the walk state — and a wrong answer there looks exactly like a right
one. Mutation testing proves the tests would notice. It runs on the files in
`web/mutation-targets.mjs`, the same list that gets a 100% per-file coverage
floor, and never on rendering code, where mutants are near-equivalent by the
thousand ([TEST_STRATEGY.md](../../TEST_STRATEGY.md) §11).

## npm audit: what's accepted

`web/package-lock.json` was seeded from CollectionBuddy's lockfile so both
projects resolve the same versions of the shared toolchain, and carries the
same `overrides`. `npm audit` reports advisories in build- and test-time
tooling (e.g. `braces`, `compression` through `serve`, `sharp`,
`source-map-js`); none of them ships in the static bundle. They are fixed with
targeted `overrides` as patched versions land, never with
`npm audit fix --force`.
