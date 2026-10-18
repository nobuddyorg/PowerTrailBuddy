import type { Page } from '@playwright/test';

import { expect, test } from '../fixture';

import { ALL_CACHES, pocketQueryGpx } from '../pocketQuery';

test.use({ locale: 'en-GB' });

async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/**
 * What Android's share sheet does, from inside the page so the worker sees it: a multipart POST of the files
 * to the manifest's share target. Returns where the worker's redirect led.
 */
function share(page: Page, files: { name: string; text: string }[]) {
  return page.evaluate(async (shared) => {
    const form = new FormData();
    for (const file of shared) {
      form.append(
        'files',
        new File([file.text], file.name, { type: 'application/gpx+xml' }),
      );
    }
    form.append('title', 'not a file');
    const response = await fetch('share-target/', {
      method: 'POST',
      body: form,
      redirect: 'follow',
    });
    return { redirected: response.redirected, url: response.url };
  }, files);
}

function sharedFileCount(page: Page) {
  return page.evaluate(async () => {
    const cache = await caches.open('powertrailbuddy-shared-files');
    return (await cache.keys()).length;
  });
}

test.describe('sharing a Pocket Query to the app', () => {
  test.beforeEach(async ({ on, page }) => {
    await on(page).home.do.open();
    await waitForController(page);
  });

  test('imports the shared file and forgets it once taken', async ({
    on,
    page,
    baseURL,
  }) => {
    const landing = await share(page, [
      { name: 'shared query.gpx', text: pocketQueryGpx() },
    ]);
    expect(landing).toEqual({ redirected: true, url: `${baseURL}?shared=1` });
    expect(await sharedFileCount(page)).toBe(1);

    const app = on(page);
    await app.home.do.open(landing.url);

    await expect(app.home.locators.importSummary).toHaveText(
      `Imported ${ALL_CACHES.length} caches from 1 file.`,
    );
    await expect(app.trails.locators.count).toHaveText('2 trails');
    // The marker goes, so a reload does not look for the share again.
    expect(new URL(page.url()).search).toBe('');
    expect(await sharedFileCount(page)).toBe(0);

    await app.home.do.reload();
    await expect(app.home.locators.importSummary).toBeHidden();
  });

  test('says so when the share delivered nothing it could keep', async ({
    on,
    page,
  }) => {
    const landing = await share(page, []);

    const app = on(page);
    await app.home.do.open(landing.url);

    await expect(app.home.locators.errorNotice).toHaveText(
      /No file arrived from the share/,
    );
    await expect(app.emptyState()).toBeVisible();
  });
});
