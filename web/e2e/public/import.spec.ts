import { expect, test } from '../fixture';

import {
  ALL_CACHES,
  gpxFile,
  notAPocketQuery,
  pocketQueryZip,
} from '../pocketQuery';

test.use({ locale: 'en-GB' });

test.describe('importing a Pocket Query', () => {
  test('ranks the trails it finds in a downloaded zip', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);

    await expect(app.home.locators.importSummary).toHaveText(
      `Imported ${ALL_CACHES.length} caches from 1 file.`,
    );
    await expect(app.trails.locators.cacheCount).toHaveText(
      `${ALL_CACHES.length} caches imported`,
    );
    await expect(app.trails.locators.count).toHaveText('2 trails');
    // The quick trail first: more caches per hour beats more caches.
    await expect(app.trails.card(0).locators.name).toHaveText('Trail #1');
    await expect(app.trails.card(0).locators.summary).toContainText(
      '11 caches',
    );
    await expect(app.trails.card(1).locators.summary).toContainText(
      '14 caches',
    );
  });

  test('says which file of a batch it refused, and imports the rest', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([
      gpxFile('9876543.gpx'),
      notAPocketQuery(),
    ]);

    await expect(app.home.locators.importSummary).toContainText(
      `Imported ${ALL_CACHES.length} caches from 2 files.`,
    );
    await expect(app.home.locators.refusedFiles).toHaveText([
      'shopping-list.txt: not a geocache .zip or .gpx file',
    ]);
    await expect(app.trails.locators.count).toHaveText('2 trails');
  });

  test('importing the same file again adds nothing', async ({ on, page }) => {
    const app = on(page);
    await app.home.do.open();
    const zip = await pocketQueryZip();
    await app.emptyState.do.importFiles([zip]);
    await app.home.do.dismissImportSummary();

    await app.data.do.open();
    await app.data.do.importFiles([zip]);

    await app.data.do.open();
    await expect(app.data.locators.counts.caches).toHaveText(
      String(ALL_CACHES.length),
    );
    await expect(app.data.locators.counts.trails).toHaveText('2');
  });

  test('keeps what it imported across a reload', async ({ on, page }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);

    await app.home.do.reload();
    await expect(app.trails.locators.count).toHaveText('2 trails');
  });

  test('tries the app out on the bundled sample data', async ({ on, page }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.trySample();

    await expect(app.home.locators.importSummary).toContainText('from 2 files');
    await expect(app.trails.locators.count).toHaveText('3 trails');
  });
});
