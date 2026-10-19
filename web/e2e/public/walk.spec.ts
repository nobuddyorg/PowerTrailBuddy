import { expect, test } from '../fixture';

import {
  denyLocation,
  downloadedBytes,
  moveDevice,
  placeDevice,
} from '../helpers';
import { offset, pocketQueryZip, QUICK_TRAIL } from '../pocketQuery';

test.use({ locale: 'en-GB' });

const codes = QUICK_TRAIL.map((cache) => cache.code);

test.describe('walking a trail', () => {
  test.beforeEach(async ({ on, page, context }) => {
    // 200 m west of the quick trail's western end.
    await placeDevice(context, offset(-200));
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();
    await app.trails.do.openTrail(0);
  });

  test('guides from the nearest end, cache by cache, to the summary', async ({
    on,
    page,
    context,
  }) => {
    const app = on(page);
    await app.trail.do.startAtNearestEnd();
    const walk = app.walk;
    await expect(walk.locators.targetCode).toHaveText(codes[0]);
    await expect(walk.locators.distance).toHaveText('200 m');

    await moveDevice(context, offset(-10));
    await expect(walk.locators.close).toBeVisible();

    await walk.do.found();
    await expect(walk.locators.progress).toHaveText('1/11');
    await expect(walk.locators.targetCode).toHaveText(codes[1]);
    await expect(walk.locators.close).toBeHidden();

    await walk.do.dnf();
    await walk.do.skip();
    await expect(walk.locators.progress).toHaveText('3/11');
    await expect(walk.locators.targetCode).toHaveText(codes[3]);

    await walk.do.undo();
    await expect(walk.locators.progress).toHaveText('2/11');
    await expect(walk.locators.targetCode).toHaveText(codes[2]);

    await app.home.do.reload();
    await expect(walk.locators.progress).toHaveText('2/11');
    await expect(walk.locators.targetCode).toHaveText(codes[2]);

    await walk.do.finish();
    await expect(walk.summary.locators.title).toHaveText('Walk finished early');
    await walk.summary.do.resume();

    for (let left = codes.length - 2; left > 0; left -= 1) {
      await walk.do.found();
    }
    await expect(walk.summary.locators.title).toHaveText('Walk complete!');
    await expect(walk.summary.locators.text).toContainText(
      '10 of 11 caches found',
    );

    const notes = await walk.summary.do.exportFieldNotes();
    expect(notes.suggestedFilename()).toBe('geocache_visits.txt');
    const bytes = await downloadedBytes(notes);
    // UTF-16LE with a byte order mark, as Geocaching.com's drafts upload reads it.
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    const lines = bytes.subarray(2).toString('utf16le').split('\r\n');
    expect(lines.at(-1)).toBe('');
    const logged = lines.slice(0, -1).map((line) => line.split(','));
    expect(logged.map(([code]) => code)).toEqual(codes);
    expect(logged.map(([, , type]) => type)).toEqual([
      'Found it',
      "Didn't find it",
      ...Array<string>(9).fill('Found it'),
    ]);
    expect(logged[0][1]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/);

    await walk.summary.do.backToTrails();
    // Ten of its caches are found now, so the quick trail is gone.
    await expect(app.trails.locators.count).toHaveText('1 trail');
  });

  test('takes the last find back from the summary', async ({ on, page }) => {
    const app = on(page);
    await app.trail.do.startAtNearestEnd();
    for (let left = codes.length; left > 0; left -= 1) {
      await app.walk.do.found();
    }
    await expect(app.walk.summary.locators.title).toHaveText('Walk complete!');

    await app.walk.summary.do.undo();

    await expect(app.walk.locators.targetCode).toHaveText(codes.at(-1)!);
    await expect(app.walk.locators.progress).toHaveText('10/11');
  });

  test('turns the rest of the walk around', async ({ on, page }) => {
    const app = on(page);
    await app.trail.do.startAtNearestEnd();
    await app.walk.do.found();

    await app.walk.do.reverse();

    await expect(app.walk.locators.targetCode).toHaveText(codes.at(-1)!);
    await expect(app.walk.locators.progress).toHaveText('1/11');
  });

  test('can start from the other end of the trail', async ({ on, page }) => {
    const app = on(page);
    const first = await app.trail.row(0).locators.facts.textContent();
    await app.trail.do.reverse();
    await app.trail.do.startWalk();

    await expect(app.walk.locators.targetCode).not.toHaveText(
      first!.split(' ')[0],
    );
    await expect(
      app.walk.locators.links.locators.links.cachePage,
    ).toBeVisible();
  });
});

test.describe('walking without the location permission', () => {
  test('still guides, and says why there is no distance', async ({
    on,
    page,
    context,
  }) => {
    await denyLocation(context);
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.trails.do.openTrail(0);

    await app.trail.do.startWalk();

    await expect(app.walk.locators.locationMessage).toHaveText(
      /Location access is blocked/,
    );
    await app.walk.do.found();
    await expect(app.walk.locators.progress).toHaveText('1/11');
  });

  // What the blocked message tells the user to do: allow it in the site settings, with no reload.
  test('picks the position up once location is allowed', async ({
    on,
    page,
    context,
  }) => {
    await denyLocation(context);
    const app = on(page);
    await app.home.do.open();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.trails.do.openTrail(0);
    await app.trail.do.startWalk();
    await expect(app.walk.locators.locationMessage).toHaveText(
      /Location access is blocked/,
    );

    await placeDevice(context, offset(-200));

    // TEMPORARY diagnostics for the Firefox CI failure; removed before merge.
    page.on('console', (message) =>
      console.log('DIAG console', message.type(), message.text()),
    );
    const states: string[] = [];
    for (let tick = 0; tick < 8; tick++) {
      const views = await page.getByTestId('walk-view').count();
      const text = await page
        .locator('body')
        .innerText()
        .catch((error: unknown) => String(error));
      states.push(
        `${tick} ${page.url()} views=${views} ${text.replace(/\s+/g, ' ').slice(0, 300)}`,
      );
      await page.waitForTimeout(500);
    }
    const probe = await page.evaluate(
      () =>
        new Promise((resolve) =>
          navigator.geolocation.getCurrentPosition(
            ({ coords }) =>
              resolve({
                lat: coords.latitude,
                heading: coords.heading,
                speed: coords.speed,
              }),
            (error) => resolve({ error: error.code }),
            { timeout: 3000 },
          ),
        ),
    );
    console.log('DIAG states', JSON.stringify(states, null, 1));
    console.log('DIAG probe', JSON.stringify(probe));

    await expect(app.walk.locators.locationMessage).toBeHidden();
    await expect(app.walk.locators.distance).toBeVisible();
  });
});
