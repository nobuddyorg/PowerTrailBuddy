import { expect, test } from '../fixture';

import {
  ALL_CACHES,
  gpxFile,
  LONG_TRAIL,
  pocketQueryZip,
} from '../pocketQuery';

test.use({ locale: 'en-GB' });

test.describe('the data on this device', () => {
  test('counts what is stored and when it was imported', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();

    await app.data.do.open();

    await expect(app.data.locators.counts.caches).toHaveText(
      String(ALL_CACHES.length),
    );
    await expect(app.data.locators.counts.trails).toHaveText('2');
    await expect(app.data.locators.counts.locallyFound).toHaveText('0');
    await expect(app.data.locators.lastImport).toHaveText(/\d/);
  });

  test('merges another import into what is there', async ({ on, page }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([
      gpxFile('long-trail.gpx', LONG_TRAIL),
    ]);
    await expect(app.trails.locators.count).toHaveText('1 trail');

    await app.data.do.open();
    await app.data.do.importFiles([await pocketQueryZip()]);

    await expect(app.trails.locators.count).toHaveText('2 trails');
  });

  test('clearing it returns to the first run, for good', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);

    await app.data.do.open();
    await app.data.do.clearAll();

    await app.home.do.reload();
    await expect(app.emptyState()).toBeVisible();
  });
});
