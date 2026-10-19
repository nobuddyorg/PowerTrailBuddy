import { expect, test } from '../fixture';

import {
  ALL_CACHES,
  gpxFile,
  notAPocketQuery,
  pocketQueryZip,
  QUICK_TRAIL,
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

  // A newer run of the query leaves out what was archived or found since: the walk must not lead there.
  test('a newer run of the same query removes the caches it no longer lists', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();
    const gone = QUICK_TRAIL.at(-1)!;
    const newerRun = ALL_CACHES.filter((cache) => cache.code !== gone.code);

    await app.data.do.open();
    await app.data.do.importFiles([gpxFile('9876543 (1).gpx', newerRun)]);

    await expect(app.home.locators.removedCaches).toHaveText(
      'Removed 1 cache the query no longer lists.',
    );
    await expect(app.trails.locators.cacheCount).toHaveText(
      `${ALL_CACHES.length - 1} caches imported`,
    );
    await expect(app.trails.card(0).locators.summary).toContainText(
      '10 caches',
    );
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
