import type { Page } from '@playwright/test';

import { expect, test } from '../fixture';

import { SW_ONLY_IN_CHROMIUM } from '../helpers';
import { ALL_CACHES, pocketQueryGpx } from '../pocketQuery';

// The worker is what these specs test, so they allow it in every project, Firefox included (playwright.config.ts).
test.use({ locale: 'en-GB', serviceWorkers: 'allow' });

async function waitForController(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// Android's share sheet: a form navigation POSTing the files (and a title) to the share target, which the worker answers with a redirect to the app.
function share(page: Page, files: { name: string; text: string }[]) {
  return page.evaluate((shared) => {
    const form = Object.assign(document.createElement('form'), {
      method: 'POST',
      enctype: 'multipart/form-data',
      action: 'share-target/',
    });
    const title = Object.assign(document.createElement('input'), {
      type: 'hidden',
      name: 'title',
      value: 'not a file',
    });
    form.append(title);
    if (shared.length > 0) {
      const input = Object.assign(document.createElement('input'), {
        type: 'file',
        name: 'files',
        multiple: true,
      });
      const transfer = new DataTransfer();
      for (const file of shared) {
        transfer.items.add(
          new File([file.text], file.name, { type: 'application/gpx+xml' }),
        );
      }
      input.files = transfer.files;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
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

  test('imports the shared file once confirmed, and forgets it once taken', async ({
    on,
    page,
  }) => {
    await share(page, [{ name: 'shared query.gpx', text: pocketQueryGpx() }]);

    const app = on(page);
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
    await share(page, [{ name: 'unexpected.gpx', text: pocketQueryGpx() }]);

    const app = on(page);
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
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', SW_ONLY_IN_CHROMIUM);
    const app = on(page);
    // setOffline misses the navigation a worker's redirect starts; refused requests reach the worker's fetches too.
    await context.route(`${new URL(baseURL!).origin}/**`, (route) =>
      route.abort('internetdisconnected'),
    );
    await share(page, [{ name: 'offline query.gpx', text: pocketQueryGpx() }]);
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
    await share(page, []);

    const app = on(page);
    await expect(app.home.locators.errorNotice).toHaveText(
      /No file arrived from the share/,
    );
    await expect(app.emptyState()).toBeVisible();
  });
});
