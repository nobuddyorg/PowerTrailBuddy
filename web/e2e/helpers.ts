import {
  expect,
  type BrowserContext,
  type Download,
  type Page,
} from '@playwright/test';

export type PageProblems = { errors: string[]; console: string[] };

/** Call before the first navigation -- listeners attached later miss everything from page load. */
export function collectPageProblems(page: Page): PageProblems {
  const problems: PageProblems = { errors: [], console: [] };
  page.on('pageerror', (error) => problems.errors.push(String(error.stack)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // A tile the tile server failed to send is its outage, not the app's error; the tile fake never fails.
    if (TILE_HOST.test(message.location().url)) return;
    problems.console.push(message.text());
  });
  return problems;
}

/** Console errors are held to the same standard as thrown ones. */
export function expectNoPageProblems(problems: PageProblems) {
  expect(problems.errors, 'uncaught errors').toEqual([]);
  expect(problems.console, 'console errors').toEqual([]);
}

// The smallest valid PNG: one transparent pixel.
const BLANK_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const TILE_HOST = /^https:\/\/([a-z]\.)?tile\.openstreetmap\.org\//;

/** Answers every OpenStreetMap tile request with a blank tile, so no test reaches a third party. */
export async function fakeMapTiles(page: Page) {
  await page.route(TILE_HOST, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: BLANK_TILE }),
  );
}

/** The tile server down: every tile request fails, as with no connection to it. */
export async function failMapTiles(page: Page) {
  await page.route(TILE_HOST, (route) => route.abort('connectionfailed'));
}

/** Every request the context's pages and workers made that left the origin under test, tiles excepted. */
export function collectForeignRequests(
  context: BrowserContext,
  origin: string,
): string[] {
  const foreign: string[] = [];
  context.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (TILE_HOST.test(url)) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  });
  return foreign;
}

/** The document's scroll width beside the window's client width, for a sideways-scroll check. */
export async function documentWidths(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** Answers from the local fake, never from a server: a fulfilled route has no server address. */
export function collectTileResponses(page: Page): { fromNetwork: boolean }[] {
  const tiles: { fromNetwork: boolean }[] = [];
  page.on('response', (response) => {
    if (!TILE_HOST.test(response.url())) return;
    void response.serverAddr().then((address) => {
      tiles.push({ fromNetwork: address !== null });
    });
  });
  return tiles;
}

type Position = { latitude: number; longitude: number };

/** Grants the location permission and puts the device at `position`, a few metres accurate. */
export async function placeDevice(context: BrowserContext, position: Position) {
  await context.grantPermissions(['geolocation']);
  await moveDevice(context, position);
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
