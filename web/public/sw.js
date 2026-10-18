// Cache-first for hashed `_next/static/**`, network-first for the app shell (pages, manifest, logo, favicons), one cache per build, plus the share target (docs/reference/architecture.md).

// Shell caches only: the share target's cache must survive a new build.
const CACHE_PREFIX = 'powertrailbuddy-shell-';

// data/sharedFiles.ts reads and empties this cache; the name and the URL shape below are its contract.
const SHARED_FILES_CACHE = 'powertrailbuddy-shared-files';

// site.webmanifest's share_target: `action` (relative to the manifest) and the files param's `name`.
const SHARE_TARGET_PATH = '/share-target/';
const SHARE_FILES_FIELD = 'files';

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

function isAppShellRequest(pathname, mode) {
  return (
    mode === 'navigate' || SHELL_FILES.some((file) => pathname.endsWith(file))
  );
}

function isShareTargetRequest(pathname, method, basePath) {
  return method === 'POST' && pathname === `${basePath}${SHARE_TARGET_PATH}`;
}

// Cross-origin (the map tiles) always passes through untouched: never intercepted, never cached.
function strategyFor(request, worker) {
  const url = new URL(request.url);
  if (url.origin !== worker.origin) return 'pass-through';
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Offline: the last shell this build served, so the app still opens.
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
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
};

self.addEventListener('install', () => {
  // Pages already serves only the new build, so waiting for old tabs to close protects nothing.
  self.skipWaiting();
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
