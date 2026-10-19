import {
  expect,
  type BrowserContext,
  type Download,
  type Page,
} from '@playwright/test';

export type PageProblems = {
  errors: string[];
  console: string[];
  cspViolations: string[];
};

// A page may be watched twice (a spec plus the automatic fixture); each watcher needs its own binding name.
let cspReporters = 0;

/** Call before the first navigation -- listeners attached later miss everything from page load. */
export async function collectPageProblems(page: Page): Promise<PageProblems> {
  const problems: PageProblems = { errors: [], console: [], cspViolations: [] };
  page.on('pageerror', (error) => problems.errors.push(String(error.stack)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // A tile or route the server failed to send is its outage, not the app's error; the fakes fail only when asked.
    if (TILE_HOST.test(message.location().url)) return;
    if (ROUTER_HOST.test(message.location().url)) return;
    problems.console.push(message.text());
  });
  // Chromium reports a blocked eval only through this event, never on the console as Firefox does.
  const reporter = `reportCspViolation${++cspReporters}`;
  await page.exposeFunction(reporter, (violation: string) =>
    problems.cspViolations.push(violation),
  );
  await page.addInitScript((name) => {
    const report = (
      window as unknown as Record<string, (text: string) => void>
    )[name];
    document.addEventListener('securitypolicyviolation', (event) =>
      report(`${event.violatedDirective} ${event.sourceFile}`),
    );
  }, reporter);
  return problems;
}

/** Console errors and CSP violations are held to the same standard as thrown errors. */
export function expectNoPageProblems(problems: PageProblems) {
  expect(problems.errors, 'uncaught errors').toEqual([]);
  expect(problems.console, 'console errors').toEqual([]);
  expect(problems.cspViolations, 'CSP violations').toEqual([]);
}

// The smallest valid PNG: one transparent pixel.
const BLANK_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const TILE_HOST = /^https:\/\/([a-z]\.)?tile\.openstreetmap\.org\//;

/** Answers every OpenStreetMap tile request with a blank tile, so no test reaches a third party; on the context, which in Chromium also routes the worker's requests. */
export async function fakeMapTiles(page: Page) {
  await page.context().route(TILE_HOST, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      // The map loads tiles with CORS, as the real tile server allows.
      headers: { 'access-control-allow-origin': '*' },
      body: BLANK_TILE,
    }),
  );
}

/** The tile server down: every tile request fails, as with no connection to it. */
export async function failMapTiles(page: Page) {
  await page
    .context()
    .route(TILE_HOST, (route) => route.abort('connectionfailed'));
}

/** Every request the context's pages and workers made that left the origin under test, tiles excepted, and the router where a spec allows it. */
export function collectForeignRequests(
  context: BrowserContext,
  { origin, allowRouter }: { origin: string; allowRouter: boolean },
): string[] {
  const foreign: string[] = [];
  context.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (TILE_HOST.test(url)) return;
    if (allowRouter && ROUTER_HOST.test(url)) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });
  return foreign;
}

const ROUTER_HOST = /^https:\/\/routing\.openstreetmap\.de\//;

const METERS_PER_DEGREE = 111_195;

type Point = { latitude: number; longitude: number };

function metersBetween(a: Point, b: Point): number {
  const north = (b.latitude - a.latitude) * METERS_PER_DEGREE;
  const east =
    (b.longitude - a.longitude) *
    METERS_PER_DEGREE *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(north, east);
}

/** Answers the routing server's table requests itself: 1.2 times the straight line, and no path across `barrierLongitude`. */
export async function fakeRouter(
  page: Page,
  {
    barrierLongitude,
    failing = false,
  }: { barrierLongitude: number; failing?: boolean },
): Promise<string[]> {
  const asked: string[] = [];
  await page.route(ROUTER_HOST, (route) => {
    const url = route.request().url();
    asked.push(url);
    if (failing)
      return route.fulfill({
        status: 503,
        headers: { 'access-control-allow-origin': '*' },
        body: 'Unavailable',
      });
    const path = new URL(url).pathname;
    const points: Point[] = path
      .slice(path.lastIndexOf('/') + 1)
      .split(';')
      .map((pair) => {
        const [longitude, latitude] = pair.split(',').map(Number);
        return { latitude, longitude };
      });
    const west = (point: Point) => point.longitude < barrierLongitude;
    const distances = points.map((from) =>
      points.map((to) =>
        west(from) === west(to) ? metersBetween(from, to) * 1.2 : null,
      ),
    );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ code: 'Ok', distances }),
    });
  });
  return asked;
}

/** The document's scroll width beside the window's client width, for a sideways-scroll check. */
export async function documentWidths(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** Answers from the local fake, never from a server: a fulfilled route has no server address. The context's, so the worker's own tile requests count. */
export function collectTileResponses(page: Page): { fromNetwork: boolean }[] {
  const tiles: { fromNetwork: boolean }[] = [];
  page.context().on('response', (response) => {
    if (!TILE_HOST.test(response.url())) return;
    void response.serverAddr().then((address) => {
      tiles.push({ fromNetwork: address !== null });
    });
  });
  return tiles;
}

type Position = { latitude: number; longitude: number };

/** Puts the device at `position`, a few metres accurate, then grants the location permission. */
export async function placeDevice(context: BrowserContext, position: Position) {
  // Fix first, as on a real phone: Firefox's emulation never delivers a later fix to a watch whose first try failed.
  await moveDevice(context, position);
  await context.grantPermissions(['geolocation']);
}

/** Both engines' protocol grants the listed permissions and denies every other, so an empty list is a refusal. */
export async function denyLocation(context: BrowserContext) {
  await context.grantPermissions([]);
}

export async function moveDevice(context: BrowserContext, position: Position) {
  await context.setGeolocation({ ...position, accuracy: 5 });
}

/** A download's bytes, read from where the browser saved it. */
export async function downloadedBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Chromium's install offer, which no headless run fires by itself; its prompt() marks `<html data-install-prompted>`. */
export async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const offer = Object.assign(
      new Event('beforeinstallprompt', { cancelable: true }),
      {
        prompt: () => {
          document.documentElement.dataset.installPrompted = 'yes';
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      },
    );
    window.dispatchEvent(offer);
  });
}

/** Why an offline test is Chromium-only: Playwright drives service workers there alone (its docs), and its Firefox offline mode fails a navigation before the worker sees it. */
export const SW_ONLY_IN_CHROMIUM =
  'offline through the service worker is only emulated in Chromium';
