import { expect, test } from '../fixture';

import { downloadedBytes } from '../helpers';
import {
  ALL_CACHES,
  fieldNotesFile,
  gpxFile,
  LONG_TRAIL,
  notAPocketQuery,
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

  test('links to the drafts upload without a walk in progress', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();

    await app.data.do.open();

    await expect(app.data.locators.links.uploadDrafts).toHaveAttribute(
      'href',
      'https://www.geocaching.com/my/uploadfieldnotes.aspx',
    );
  });

  test('loads saved field notes and saves them again with a log text', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();
    await app.data.do.open();

    await app.data.do.loadFieldNotes(
      fieldNotesFile([
        'GC0FN1,2026-06-01T10:10Z,Found it,""',
        'GC0FN2,2026-06-01T10:20Z,Didn\'t find it,"old text"',
      ]),
    );
    await expect(app.data.locators.fieldNotes.read).toHaveText(
      '2 visits read.',
    );
    await app.data.do.writeLogText('TFTC');
    const notes = await app.data.do.saveFieldNotes();

    expect(notes.suggestedFilename()).toBe('geocache_visits.txt');
    const bytes = await downloadedBytes(notes);
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    expect(bytes.subarray(2).toString('utf16le')).toBe(
      'GC0FN1,2026-06-01T10:10Z,Found it,"TFTC"\r\n' +
        'GC0FN2,2026-06-01T10:20Z,Didn\'t find it,"TFTC"\r\n',
    );
  });

  test('says why a file is not field notes', async ({ on, page }) => {
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();
    await app.data.do.open();

    await app.data.do.loadFieldNotes(notAPocketQuery());
    await expect(app.data.locators.fieldNotes.problem).toContainText(
      'not a field notes file',
    );
    await expect(app.data.locators.buttons.saveFieldNotes).toBeHidden();

    await app.data.do.loadFieldNotes(
      fieldNotesFile(['GC0FN1,2026-06-01T10:10Z,Found it,""', 'nonsense']),
    );
    await expect(app.data.locators.fieldNotes.problem).toContainText('Line 2');
  });

  test('fills the whole screen on a phone', async ({ on, page, isMobile }) => {
    test.skip(!isMobile, 'a sheet over the app on a wider screen');
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();

    await app.data.do.open();

    expect(await app.data().boundingBox()).toEqual({
      x: 0,
      y: 0,
      ...page.viewportSize(),
    });
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
