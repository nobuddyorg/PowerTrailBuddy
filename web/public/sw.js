// Precached on install, then cache-first for hashed `_next/static/**`, network-first for the app shell (pages, manifest, logo, favicons), one cache per build, the map tiles viewed, plus the share target (docs/reference/architecture.md).

// Shell caches only: the share target's cache must survive a new build.
const CACHE_PREFIX = 'powertrailbuddy-shell-';

// data/sharedFiles.ts reads and empties this cache; the name and the URL shape below are its contract.
const SHARED_FILES_CACHE = 'powertrailbuddy-shared-files';

// site.webmanifest's share_target: `action` (relative to the manifest) and the files param's `name`.
const SHARE_TARGET_PATH = '/share-target/';
const SHARE_FILES_FIELD = 'files';

// Kept across builds like the shared files: the tiles viewed online, so the same area still has a map offline.
const TILE_CACHE = 'powertrailbuddy-tiles';
const TILE_ORIGIN = 'https://tile.openstreetmap.org';
// About 30-50 MB of OpenStreetMap tiles; the oldest go first.
const MAX_TILES = 2000;
// Older than this, a tile is fetched again when the network answers; offline it is still shown.
const MAX_TILE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// A tile's own headers say nothing about when it was kept, so the kept copy carries that itself.
const KEPT_AT_HEADER = 'x-powertrailbuddy-kept-at';

// A weak signal neither answers nor fails for tens of seconds; past this the kept shell opens instead.
const NETWORK_TIMEOUT_MS = 3000;

// A Pocket Query share is one zip of a few MB; anything far past these is not one.
const MAX_SHARED_FILES = 20;
const MAX_SHARED_BYTES = 100 * 1024 * 1024;

// Each build registers `sw.js?build=<id>`; an old build's HTML still registers plain `sw.js`.
function cacheNameFor(search) {
  const build = new URLSearchParams(search).get('build') ?? 'unversioned';
  return `${CACHE_PREFIX}${build}`;
}

// sw.js sits at the root of the base path, so its directory is the base path.
function basePathFor(workerPathname) {
  return workerPathname.slice(0, workerPathname.lastIndexOf('/'));
}

const CACHE_NAME = cacheNameFor(self.location.search);
const WORKER = {
  origin: self.location.origin,
  basePath: basePathFor(self.location.pathname),
};

// The prefix spares other sites' caches: every project page of an account shares one github.io origin.
function isStaleCache(key, current) {
  return key.startsWith(CACHE_PREFIX) && key !== current;
}

function isHashedStaticAsset(pathname) {
  return pathname.includes('/_next/static/');
}

// What every page loads by URL besides the bundle; passed through, each fails offline with a console error.
const SHELL_FILES = [
  '/site.webmanifest',
  '/logo.svg',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
];

// scripts/precache-manifest.mjs writes it after `next build`: every hashed asset, the lazily loaded ones too.
const PRECACHE_MANIFEST = '/precache-manifest.json';

// Revalidated, not taken from the HTTP cache: an old build's page or list would name assets the host no longer has.
function freshRequest(path) {
  const url = new URL(`${WORKER.basePath}${path}`, WORKER.origin);
  return new Request(url, { cache: 'no-cache' });
}

// A worker installs with the whole shell or not at all, so the first visit, and each deploy, works offline.
async function precacheShell(cacheName) {
  const response = await fetch(freshRequest(PRECACHE_MANIFEST));
  if (!response.ok)
    throw new Error(`Precache manifest: HTTP ${response.status}`);
  const assets = await response.json();
  const cache = await caches.open(cacheName);
  await cache.addAll(['/', ...SHELL_FILES, ...assets].map(freshRequest));
}

function isAppShellRequest(pathname, mode) {
  return (
    mode === 'navigate' || SHELL_FILES.some((file) => pathname.endsWith(file))
  );
}

function isShareTargetRequest(pathname, method, basePath) {
  return method === 'POST' && pathname === `${basePath}${SHARE_TARGET_PATH}`;
}

// A tile URL as components/Map/ builds it: `{z}/{x}/{y}.png`.
function isMapTile(url) {
  return (
    url.origin === TILE_ORIGIN && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)
  );
}

// Cross-origin passes through untouched (the routing server above all), map tiles alone excepted.
function strategyFor(request, worker) {
  const url = new URL(request.url);
  if (url.origin !== worker.origin) {
    return request.method === 'GET' && isMapTile(url) ? 'tile' : 'pass-through';
  }
  if (isShareTargetRequest(url.pathname, request.method, worker.basePath)) {
    return 'share';
  }
  // A GET is the only method either caching strategy is safe to apply to.
  if (request.method !== 'GET') return 'pass-through';
  if (isHashedStaticAsset(url.pathname)) return 'cache-first';
  if (isAppShellRequest(url.pathname, request.mode)) return 'network-first';
  return 'pass-through';
}

// encodeURIComponent leaves `.` and `..` alone, and a URL would resolve them away as path segments.
function sharedFilePath(basePath, index, name) {
  const usable = name.replace(/\./g, '') === '' ? `shared-${index}` : name;
  return `${basePath}/shared-file/${index}/${encodeURIComponent(usable)}`;
}

// A text field sent along is no file; past either limit the whole share is refused, never trimmed.
function sharedFilesWithinLimits(values) {
  const files = values.filter((value) => typeof value !== 'string');
  if (files.length > MAX_SHARED_FILES) return [];
  const bytes = files.reduce((total, file) => total + file.size, 0);
  return bytes > MAX_SHARED_BYTES ? [] : files;
}

async function storeSharedFiles(files) {
  // An earlier share the page never took is replaced, so the page imports exactly this one.
  await caches.delete(SHARED_FILES_CACHE);
  const cache = await caches.open(SHARED_FILES_CACHE);
  try {
    await Promise.all(
      files.map((file, index) =>
        cache.put(
          sharedFilePath(WORKER.basePath, index, file.name),
          new Response(file),
        ),
      ),
    );
  } catch (error) {
    // Never half-stored: the page finds nothing rather than part of the share.
    console.error('Storing the shared files failed:', error);
    await caches.delete(SHARED_FILES_CACHE);
  }
}

// The page imports whatever the cache holds after `?shared=1`; a refused share leaves it empty.
async function receiveShare(request) {
  const files = await request.formData().then(
    (form) => sharedFilesWithinLimits(form.getAll(SHARE_FILES_FIELD)),
    () => [],
  );
  if (files.length > 0) {
    await storeSharedFiles(files);
  } else {
    await caches.delete(SHARED_FILES_CACHE);
  }
  // 303: the browser follows a POST's redirect with a GET, so a reload never re-sends the share.
  const landing = new URL(`${WORKER.basePath}/?shared=1`, WORKER.origin);
  return Response.redirect(landing.href, 303);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    void cache.put(request, response.clone());
  }
  return response;
}

function settlesWithin(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No answer within ${timeoutMs} ms`)),
      timeoutMs,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function networkFirst(request, timeoutMs = NETWORK_TIMEOUT_MS) {
  const cache = await caches.open(CACHE_NAME);
  // A late answer still updates the kept shell, for the next start.
  const network = fetch(request).then((response) => {
    if (response.ok) void cache.put(request, response.clone());
    return response;
  });
  try {
    return await settlesWithin(network, timeoutMs);
  } catch {
    // Offline or too slow: the last shell this build served; the page under any query, as after a share's `?shared=1`.
    const cached = await cache.match(request, { ignoreSearch: true });
    // Nothing kept: wait for the network after all, and fail as it does.
    return cached ?? network;
  }
}

function isFreshTile(response, now) {
  const keptAt = Number(response.headers.get(KEPT_AT_HEADER));
  return now - keptAt < MAX_TILE_AGE_MS;
}

// The cache lists its entries oldest first, and putting a tile again moves it to the end.
async function evictOldTiles(cache, maxTiles) {
  const keys = await cache.keys();
  const excess = keys.slice(0, Math.max(0, keys.length - maxTiles));
  await Promise.all(excess.map((key) => cache.delete(key)));
}

async function keepTile(cache, request, response, now) {
  const headers = {
    'content-type': response.headers.get('content-type') ?? 'image/png',
    [KEPT_AT_HEADER]: String(now),
  };
  await cache.put(request, new Response(await response.blob(), { headers }));
  await evictOldTiles(cache, MAX_TILES);
}

// What an image gets when there is neither a network nor a kept tile: an error status, never a rejected fetch.
function missingTile() {
  return new Response('', { status: 504, statusText: 'Offline' });
}

// Only tiles viewed before are kept, never an area fetched in advance: the OpenStreetMap tile policy forbids that.
async function tileFirst(request, now = Date.now()) {
  const cache = await caches.open(TILE_CACHE);
  const kept = await cache.match(request);
  if (kept && isFreshTile(kept, now)) return kept;
  try {
    const response = await fetch(request);
    if (!response.ok) return kept ?? response;
    void keepTile(cache, request, response.clone(), now);
    return response;
  } catch {
    // Offline: a tile past its age still beats a blank map.
    return kept ?? missingTile();
  }
}

async function deleteStaleCaches(current) {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => isStaleCache(key, current))
      .map((key) => caches.delete(key)),
  );
}

const STRATEGIES = {
  share: receiveShare,
  'cache-first': cacheFirst,
  'network-first': networkFirst,
  tile: tileFirst,
};

self.addEventListener('install', (event) => {
  // Pages already serves only the new build, so waiting for old tabs to close protects nothing.
  event.waitUntil(precacheShell(CACHE_NAME).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    deleteStaleCaches(CACHE_NAME).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request, WORKER);
  if (strategy === 'pass-through') return;
  event.respondWith(STRATEGIES[strategy](event.request));
});
