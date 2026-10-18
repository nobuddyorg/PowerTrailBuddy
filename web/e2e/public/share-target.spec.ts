import type { Page } from '@playwright/test';

import { expect, test } from '../fixture';

import { ALL_CACHES, pocketQueryGpx } from '../pocketQuery';

test.use({ locale: 'en-GB' });

async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// Android's share sheet: a multipart POST of the files to the share target, sent from the page so the worker sees it.
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

// The share sheet's real request: a form navigation, which the worker answers with a redirect to the app.
function shareByForm(page: Page, file: { name: string; text: string }) {
  return page.evaluate((shared) => {
    const input = Object.assign(document.createElement('input'), {
      type: 'file',
      name: 'files',
    });
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([shared.text], shared.name, { type: 'application/gpx+xml' }),
    );
    input.files = transfer.files;
    const form = Object.assign(document.createElement('form'), {
      method: 'POST',
      enctype: 'multipart/form-data',
      action: 'share-target/',
    });
    form.append(input);
    document.body.append(form);
    form.submit();
  }, file);
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

  test('imports the shared file once confirmed, and forgets it once taken', async ({
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
    await expect(app.sharedImport.locators.files).toHaveText([
      'shared query.gpx',
    ]);
    await app.sharedImport.do.accept();

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

  // Any website can post a form to the share target; nothing it sends is imported without the user's tap.
  test('imports nothing, and forgets the share, when the user cancels', async ({
    on,
    page,
  }) => {
    const landing = await share(page, [
      { name: 'unexpected.gpx', text: pocketQueryGpx() },
    ]);

    const app = on(page);
    await app.home.do.open(landing.url);
    await app.sharedImport.do.cancel();

    await expect(app.emptyState()).toBeVisible();
    await expect(app.home.locators.importSummary).toBeHidden();
    expect(await sharedFileCount(page)).toBe(0);
    await app.home.do.reload();
    await expect(app.sharedImport()).toBeHidden();
    await expect(app.emptyState()).toBeVisible();
  });

  // A Pocket Query shared from the field, where there is no signal.
  test('takes a share with the network gone', async ({
    on,
    page,
    context,
    baseURL,
  }) => {
    const app = on(page);
    // setOffline misses the navigation a worker's redirect starts; refused requests reach the worker's fetches too.
    await context.route(`${new URL(baseURL!).origin}/**`, (route) =>
      route.abort('internetdisconnected'),
    );
    await shareByForm(page, {
      name: 'offline query.gpx',
      text: pocketQueryGpx(),
    });
    await expect(app.sharedImport.locators.files).toHaveText([
      'offline query.gpx',
    ]);
    await app.sharedImport.do.accept();
    await expect(app.trails.locators.count).toHaveText('2 trails');
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
