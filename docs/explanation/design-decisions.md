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
privacy guarantee is enforced, not promised: the CSP's `connect-src` names
only the app's own origin and the opt-in routing server, and the browser suite
fails on any request to another origin. Map tiles come from outside, and a
tile URL reveals only the area being viewed. The routing server is contacted
only after the user turns walking routes on (next section).

## Why walking only, with opt-in walking routes over a detour factor

The app plans walks, not drives: power trails along forest paths and field
tracks are what it is for. By default a straight-line distance multiplied by a
**detour factor** (default 1.3, a common rule of thumb for footpaths) ranks
trails and estimates time: private, instant, and good enough where paths run
between the caches.

It fails where they don't: two caches 80 m apart on either side of a motorway,
a river or a railway are one trail to a straight line, and a 2 km walk to the
next bridge on foot. Shipping a routing graph is far too large for a static
site, so the app asks a router, and only once the user opts in, because that
sends the trail caches' coordinates to a third party:

- **Which router.** FOSSGIS's public OSRM server, foot profile
  (`routing.openstreetmap.de/routed-foot`). It needs no key (a static site
  cannot keep one secret), sends CORS headers (openstreetmap.org calls it from
  the browser), and its `table` service answers every pair among up to 100
  points in one request, `null` where no path joins them. Valhalla's public
  matrix limits are stricter and unpublished; BRouter has no matrix. Keyed
  services (GraphHopper, openrouteservice) would need a backend.
- **Within its policy.** At most one request a second, batches of 50 caches,
  at most 60 requests a visit, distances kept in IndexedDB so a pair is never
  asked twice, attribution and a "fix the map" link beside the trails. The
  limits and the request decisions live in pure functions
  (`lib/routing/requestPolicy.ts`) under mutation testing, not in the hook.
- **What gets asked, in which order.** Windows of 50 consecutive caches in
  walking order first: one request answers 1,225 pairs, most of them the
  legs. A link between caches far apart in that order, such as across a river
  two parallel rows of caches run along, no window holds; leaving it on its
  estimate would keep both banks one trail. So every remaining link of a
  group big enough for a trail, found through the spatial grid rather than
  all pairs, is asked next, packed so a cache two links share is sent once.
  Trail legs come last, because the links may still split the trails.
- **Off the urgent render.** Planning runs the link, order and split stages
  again, as long as finding the trails itself; it runs in a deferred render
  like `useTrails`, and a request is named by its URL, so a found mark that
  leaves the first batch as it was neither waits for the planner nor aborts
  and re-sends that batch.
- **What a route changes.** Trail finding still links caches closer than
  `maxGapMeters` in a straight line; a routed gap longer than
  `2 × maxGapMeters × detourFactor` (or unroutable) is a barrier and does not
  link. Each leg of a walk and its way back counts its routed distance where
  known, else the straight line times the detour factor, so walk splitting,
  time and caches per hour follow real paths. With every route equal to its
  estimate the trails are exactly those without routes.
- **Determinism.** `findTrails` takes the routed distances as an input, so
  the same distances give the same trails; only the hook that fetches them is
  asynchronous.

## Why a newer run of a query replaces its caches

A Pocket Query run leaves out what was archived, disabled or found online
since the last one. A plain union would keep those caches forever, and a walk
would lead to a cache that is gone. Replacing everything on each import
would break the other half of the import story: several queries side by side
for an area larger than 1,000 caches. So each cache remembers the queries that
delivered it, named after the GPX file, which for a Pocket Query is its
stable number, and a query imported again replaces only its own caches. The
name comes from the GPX file rather than the zip, because a browser renames
a repeated download (`26071826 (1).zip`) but never what is inside it. Caches
stored before sources were kept cannot be attributed to a query, so they stay
rather than vanish on a guess.

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

## Why round trips are opt-in, and closed after the split

A walk is already scored with its way back, but in an open order that way
back is a long walk past caches already found, and the car is at the start.
**Round trips only** reorders each walk so it ends next to where it starts:
2-opt over the closed tour, which minimises exactly the walk the score
counts, then the start moves to just after the shortest leg. A chain along a
road becomes out along it and back to the car, no longer than before. It
works on each walk after the greedy split, not on the whole group, so the
round trips still fit `maxWalkKilometers`; the setting adds a limit on the
way back, and walks that cannot meet it are dropped. It is off by default so
the open walks people know, starting at one end of a chain, stay as they are.

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

The worker has four small jobs — cache the shell per build, delete old
builds' caches, keep the map tiles viewed, receive shared files — and each is
a few lines of the Cache API. A generated worker (Workbox and friends) would
add a build plugin and a configuration layer larger than the worker itself;
the one thing it needs from the build, the list of hashed assets to precache,
is a short Next.js adapter whose `onBuildComplete` runs at the end of every
`next build`, so no way of building can leave the list out (a separate step
after the build could be skipped, and the worker would then fail to install
without a word). Its decision functions are kept as small named functions so
`sw.test.ts`, `sw.strategies.test.ts` and `sw.lifecycle.test.ts` can extract
and test them from the source text; shell caches are prefixed `powertrailbuddy-shell-` so the
cleanup can never delete the `powertrailbuddy-shared-files` cache a share is
waiting in, or the `powertrailbuddy-tiles` cache.

The shell is network-first so a deploy reaches users at once, but with a
three-second limit: on one bar of signal a request neither answers nor
fails for tens of seconds, and the walk the app exists for starts exactly
there. The network's answer is never stored: after a deploy it is the next
build's page, whose chunks the old build's cache lacks, and an offline start
from it would never hydrate. A build's own install is the only writer of its
shell cache, and that install already holds the page.

A new worker still takes over at once (`skipWaiting`), since Pages serves only
the new build and waiting for every window to close can take days on an
installed app. What an open page of the previous build still needs, the
lazily loaded map chunk and fonts, stays reachable because the install keeps
the cache of the worker it replaces (read from the registration's `active`
worker, so no record of the build order is kept) and deletes only older
ones; cache-first looks in every shell cache of this app. Dropping
`skipWaiting` instead would need a reload prompt and would leave the old
build running until every window closed.

Cache-first never searches the whole origin's caches: on GitHub Pages every
project site of an account shares one `github.io` origin, so a sibling app's
cache holding one of this app's URLs would otherwise be served as this app's
script. The restriction is by name, so it stops accidents and blunt
injection, not a sibling that writes into `powertrailbuddy-shell-*` itself;
such an app can already read this app's IndexedDB and its `lang` key, and its
scripts count as `'self'` under this app's CSP. That residue is inherent to
the shared origin, and deploying under a custom domain (`PAGES_BASE_URL`)
removes it ([risk model](../reference/risk-model.md)).

Tiles are the opposite trade: cache-first for a week, because a map a
few days old is as good for a walk and every tile not fetched is load off
OpenStreetMap's volunteer-run servers. Only tiles already viewed are kept,
since the tile usage policy forbids downloading an area in advance.

## Why there is only a light theme

The map is most of the screen, and OpenStreetMap's standard tiles are light.
A dark header, panel and bottom sheet around a bright map read as two apps
glued together and make the map look glaring, while dark tiles would mean a
second tile server, against the one-outside-request rule. So `globals.css`
defines one light palette (forest green for trails and actions, orange for the
walk's current target), `layout.tsx` declares `color-scheme: light` and one
`theme-color`, and nothing reacts to `prefers-color-scheme`.

## Why the header looks like the other nobuddyorg apps

PowerTrailBuddy is one of a family of Buddy apps (CollectionBuddy, BikeBuddy,
FairBuddy and others) that share one mark, so a user recognises the family:
a flat amber icon with a thick dark-brown outline (here a geocache box with a
lightning bolt at the end of a dotted trail, `web/public/logo.svg`), and a
wordmark in Archivo bold with an ink rule under the first word and "Buddy" in
the shared brand orange (`--brand-accent`). Archivo comes through
`next/font`, which self-hosts the files at build time, so the CSP's
`font-src 'self'` and the one-outside-request rule still hold, and the
service worker precaches the font with the rest of the bundle. After changing
`logo.svg`, `node scripts/make-icons.mjs` regenerates the PNG icons.

## Why mutation testing is scoped to a list of files

The value of the app is in pure logic — the parser, the geometry, the trail
finder, the walk state — and a wrong answer there looks exactly like a right
one. Mutation testing proves the tests would notice. It runs on the files in
`web/mutation-targets.mjs`, the same list that gets a 100% per-file coverage
floor, and never on rendering code, where mutants are near-equivalent by the
thousand ([TEST_STRATEGY.md](../../TEST_STRATEGY.md) §11). The service worker
is mutated too, from a list of its own: its tests evaluate the script's text,
so V8 coverage cannot see it and mutation is its only gate.

## npm audit: what's accepted

`web/package-lock.json` was seeded from CollectionBuddy's lockfile so both
projects resolve the same versions of the shared toolchain, and carries the
same `overrides`. `npm audit` reports advisories in build- and test-time
tooling (e.g. `braces`, `compression` through `serve`, `sharp`,
`source-map-js`); none of them ships in the static bundle. They are fixed with
targeted `overrides` as patched versions land, never with
`npm audit fix --force`.
