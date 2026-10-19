import type { Page } from '@playwright/test';

import { expect, test } from '../fixture';

import { failMapTiles, SW_ONLY_IN_CHROMIUM } from '../helpers';
import { createPageTree } from '../pages';
import { pocketQueryZip } from '../pocketQuery';

// What sw.test.ts cannot reach from source: registration, scope, cache, offline.
test.use({ locale: 'en-GB' });

/** Controlling, not merely registered: an uncontrolled page's requests never reach the fetch handler. */
async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** The cache of the build that registered the active worker (sw.js names it after `?build=`). */
function currentCacheName(page: Page) {
  return page.evaluate(async () => {
    const { active } = await navigator.serviceWorker.ready;
    return `powertrailbuddy-shell-${new URL(active!.scriptURL).searchParams.get('build')}`;
  });
}

async function cachedUrls(page: Page) {
  const cacheName = await currentCacheName(page);
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => request.url);
  }, cacheName);
}

function cacheNames(page: Page) {
  return page.evaluate(() => caches.keys());
}

function keptTileUrls(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('powertrailbuddy-tiles');
    return (await cache.keys()).map((request) => request.url);
  });
}

// The worker installs with the whole shell, so a page it controls has everything cached already.
async function openWithCachedShell(page: Page) {
  await createPageTree(page).home.do.open();
  await waitForController(page);
}

test.describe('the service worker', () => {
  test('registers itself under the path the app is served from', async ({
    page,
    baseURL,
  }) => {
    await page.goto('');
    await waitForController(page);

    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return { scope: ready.scope, scriptURL: ready.active!.scriptURL };
    });

    // A scope at the origin root is refused on a subdirectory host.
    expect(registration.scope).toBe(baseURL);
    const scriptURL = new URL(registration.scriptURL);
    expect(`${scriptURL.origin}${scriptURL.pathname}`).toBe(
      new URL('sw.js', baseURL).toString(),
    );
    // The build is what gives each deploy a worker, and a cache, of its own.
    expect(scriptURL.searchParams.get('build')).toMatch(/^[\w-]{8,}$/);
  });

  test('keeps the hashed bundle and the shell, and nothing from anywhere else', async ({
    page,
  }) => {
    await openWithCachedShell(page);

    const urls = await cachedUrls(page);
    expect(urls.some((url) => url.includes('/_next/static/'))).toBe(true);

    // The page itself, and the files every page links by URL.
    const shell = new URL('./', page.url()).toString();
    const shellFile =
      /^(|site\.webmanifest|logo\.svg|favicon\.ico|favicon-32x32\.png|apple-touch-icon\.png)$/;
    const unexpected = urls.filter(
      (url) =>
        !url.startsWith(shell) ||
        !(
          url.startsWith(`${shell}_next/static/`) ||
          shellFile.test(url.slice(shell.length))
        ),
    );
    expect(unexpected, 'cached beyond the bundle and the shell').toEqual([]);
    // The activate handler drops every shell cache but the current one; the tiles viewed have a cache of their own.
    expect(
      (await cacheNames(page)).filter(
        (name) => name !== 'powertrailbuddy-tiles',
      ),
    ).toEqual([await currentCacheName(page)]);
  });

  test("a new build's worker deletes the old builds' caches, and only those", async ({
    page,
    baseURL,
  }) => {
    await openWithCachedShell(page);
    const previous = await currentCacheName(page);
    await page.evaluate(async () => {
      await caches.open('powertrailbuddy-shell-v1');
      await caches.open('powertrailbuddy-shared-files');
      await caches.open('another-site-on-this-origin');
    });

    await page.evaluate(async (scope) => {
      await navigator.serviceWorker.register(
        new URL('sw.js?build=e2e-next', scope).toString(),
        { scope },
      );
    }, baseURL!);

    await expect.poll(() => cacheNames(page)).not.toContain(previous);
    const remaining = await cacheNames(page);
    expect(remaining).not.toContain('powertrailbuddy-shell-v1');
    // A share the page has not taken yet survives an update.
    expect(remaining).toContain('powertrailbuddy-shared-files');
    expect(remaining).toContain('another-site-on-this-origin');
  });

  // Why the worker exists: walking means patchy coverage, and the host sends no cache headers.
  test('still opens the app, with its trails, with the network gone', async ({
    on,
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', SW_ONLY_IN_CHROMIUM);
    const app = on(page);
    await app.home.do.open();
    await waitForController(page);
    await app.emptyState.do.importFiles([await pocketQueryZip()]);

    await context.setOffline(true);
    try {
      await app.home.do.reload();
      await expect(app.home.locators.offline).toBeVisible();
      await expect(app.trails.locators.count).toHaveText('2 trails');
    } finally {
      await context.setOffline(false);
    }
  });

  // Only the empty first page loaded online: the map's lazily loaded code has to come from the install.
  test('works offline after a single visit, map included', async ({
    on,
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', SW_ONLY_IN_CHROMIUM);
    const app = on(page);
    await app.home.do.open();
    await waitForController(page);

    await context.setOffline(true);
    try {
      await app.home.do.reload();
      await expect(app.home.locators.offline).toBeVisible();
      await app.emptyState.do.importFiles([await pocketQueryZip()]);
      await expect(app.trails.locators.count).toHaveText('2 trails');
      await expect(app.map()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  // The map is the one part that needs the network; what was viewed online is kept for the walk.
  test('shows the map tiles viewed online once the network is gone', async ({
    on,
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', SW_ONLY_IN_CHROMIUM);
    const app = on(page);
    await app.home.do.open();
    await waitForController(page);
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.trails.do.openTrail(0);
    await expect(app.map.locators.loadedTiles.first()).toBeVisible();
    const viewed = await app.map.locators.loadedTiles.evaluateAll((tiles) =>
      tiles.map((tile) => (tile as HTMLImageElement).src),
    );
    await expect
      .poll(async () => {
        const kept = await keptTileUrls(page);
        return viewed.filter((url) => !kept.includes(url));
      })
      .toEqual([]);

    await failMapTiles(page);
    await context.setOffline(true);
    try {
      await app.home.do.reload();
      await app.trails.do.openTrail(0);
      await expect(app.map.locators.loadedTiles.first()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  // One bar in the woods: the request neither answers nor fails, and the kept shell must not wait for it.
  test('opens from the kept shell when the network hangs', async ({
    on,
    page,
    context,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', SW_ONLY_IN_CHROMIUM);
    const app = on(page);
    await app.home.do.open();
    await waitForController(page);
    await app.emptyState.do.importFiles([await pocketQueryZip()]);

    // Never answered: the route is dropped when the context closes.
    await context.route(baseURL!, () => {});
    await app.home.do.reload();

    await expect(app.trails.locators.count).toHaveText('2 trails');
  });
});
