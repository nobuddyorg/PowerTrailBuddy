import { expect, type Page } from '@playwright/test';

export type PageProblems = { errors: string[]; console: string[] };

/** Call before the first navigation -- listeners attached later miss everything from page load. */
export function collectPageProblems(page: Page): PageProblems {
  const problems: PageProblems = { errors: [], console: [] };
  page.on('pageerror', (error) => problems.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.console.push(message.text());
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

/** Every request the page made that left the origin under test, tiles excepted. */
export function collectForeignRequests(page: Page, origin: string): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
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
