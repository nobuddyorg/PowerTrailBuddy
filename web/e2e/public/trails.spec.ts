import { expect, test } from '../fixture';

import {
  collectTileResponses,
  downloadedBytes,
  failMapTiles,
  placeDevice,
} from '../helpers';
import {
  offset,
  pocketQueryZip,
  QUICK_TRAIL,
  QUICK_TRAIL_PARKING,
} from '../pocketQuery';

test.use({ locale: 'en-GB' });

test.beforeEach(async ({ on, page }) => {
  const app = on(page);
  await app.home.do.open();
  await app.emptyState.do.importFiles([await pocketQueryZip()]);
  await app.home.do.dismissImportSummary();
});

test.describe('the trail list', () => {
  test('sorts by size and by length as asked', async ({ on, page }) => {
    const trails = on(page).trails;

    await trails.do.sortBy('caches');
    await expect(trails.card(0).locators.summary).toContainText('14 caches');
    await expect(trails.card(0).locators.name).toHaveText('Trail #2');

    await trails.do.sortBy('shortest');
    await expect(trails.card(0).locators.summary).toContainText('11 caches');
  });

  test('filters out the trails longer than 5 km', async ({ on, page }) => {
    const trails = on(page).trails;

    await trails.do.toggleFilter('short');
    await expect(trails.locators.cards).toHaveCount(1);
    await expect(trails.card(0).locators.summary).toContainText('11 caches');

    await trails.do.toggleFilter('short');
    await expect(trails.locators.cards).toHaveCount(2);
  });

  test('measures each trail from the user, once the position is known', async ({
    on,
    page,
    context,
  }) => {
    // 9 km south of the quick trail, so the long one, 2 km further north, is out of reach.
    await placeDevice(context, offset(0, -9000));
    await on(page).home.do.reload();
    const trails = on(page).trails;
    await expect(trails.card(1).locators.distance).toHaveText('11.0 km away');

    await trails.do.sortBy('nearest');
    await expect(trails.card(0).locators.distance).toHaveText('9.0 km away');
    await trails.do.toggleFilter('near');
    await expect(trails.locators.cards).toHaveCount(1);
  });

  test('finds a cache by its code', async ({ on, page }) => {
    const app = on(page);

    await app.trails.do.search('gce2b05');
    await expect(app.trails.locators.searchResults).toHaveCount(1);
    await app.trails.do.openSearchResult();

    await expect(app.cache.locators.code).toHaveText('GCE2B05');
    await app.cache.do.openTrail();
    await expect(app.trail.locators.title).toHaveText('Trail #1');
  });
});

test.describe('a trail', () => {
  test('lists its caches in walking order, either way round', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.trails.do.openTrail(0);
    await expect(app.trail.locators.rows).toHaveCount(QUICK_TRAIL.length);
    const first = await app.trail.row(0).locators.facts.textContent();
    const last = await app.trail.row(10).locators.facts.textContent();

    await app.trail.do.reverse();

    await expect(app.trail.row(0).locators.facts).toHaveText(last!);
    await expect(app.trail.row(10).locators.facts).toHaveText(first!);
  });

  test('is drawn on the map, from tiles that never leave the machine', async ({
    on,
    page,
  }) => {
    const tiles = collectTileResponses(page);
    const app = on(page);
    await expect(app.map.locators.badges).toHaveCount(2);

    await app.trails.do.openTrail(0);

    await expect(app.map.locators.tiles.first()).toBeVisible();
    await expect.poll(() => tiles.length).toBeGreaterThan(0);
    expect(tiles.filter((tile) => tile.fromNetwork)).toEqual([]);
  });

  test('leads to its parking with a navigation link', async ({ on, page }) => {
    const app = on(page);
    await app.trails.do.openTrail(0);

    const { latitude, longitude } = QUICK_TRAIL_PARKING;
    const pair = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    await expect(app.trail.locators.parking).toHaveAttribute(
      'href',
      `geo:${pair}?q=${pair}(Parking%2C%20trail%20%231)`,
    );
  });

  test('exports itself as a GPX file for a navigation app', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.trails.do.openTrail(0);

    const download = await app.trail.do.exportGpx();

    expect(download.suggestedFilename()).toBe('powertrail-1.gpx');
    const gpx = (await downloadedBytes(download)).toString('utf8');
    expect(gpx).toContain('<gpx');
    expect(gpx).toContain('<name>PKE2B01</name>');
    const routeCodes = [...gpx.matchAll(/<rtept[^>]*><name>(\w+)<\/name>/g)];
    expect(routeCodes.map((match) => match[1]).sort()).toEqual(
      QUICK_TRAIL.map((cache) => cache.code),
    );
    await expect(app.toast()).toHaveText(/GPX file saved/);
  });
});

test.describe('a cache', () => {
  test('links to its listing, a navigation app and walking directions', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.trails.do.openTrail(0);
    const row = app.trail.row(0);
    await row.do.expand();
    const code = (await row.locators.facts.textContent())!.split(' ')[0];
    const cache = QUICK_TRAIL.find((each) => each.code === code)!;
    const pair = `${cache.latitude.toFixed(6)},${cache.longitude.toFixed(6)}`;

    await row.do.showOnMap();

    const links = app.cache.locators.links.locators.links;
    await expect(links.cachePage).toHaveAttribute(
      'href',
      `https://coord.info/${code}`,
    );
    await expect(links.navigate).toHaveAttribute(
      'href',
      `geo:${pair}?q=${pair}(${encodeURIComponent(`${code} ${cache.name}`)})`,
    );
    await expect(links.directions).toHaveAttribute(
      'href',
      `https://www.google.com/maps/dir/?api=1&destination=${pair}&travelmode=walking`,
    );
  });

  test('copies its coordinates the way geocachers write them', async ({
    on,
    page,
    context,
    browserName,
  }) => {
    // Chromium asks for the permission; Firefox allows a write from a click without one.
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const app = on(page);
    await app.trails.do.search('GCE2B01');
    await app.trails.do.openSearchResult();

    await app.cache.locators.links.do.copyCoordinates();

    await expect(app.toast()).toHaveText(
      'Copied: N 50° 18.000′ E 008° 54.000′',
    );
  });

  test('marked found, it leaves its trail', async ({ on, page }) => {
    const app = on(page);
    await app.trails.do.search('GCE2B06');
    await app.trails.do.openSearchResult();

    await app.cache.do.markFound();
    await app.cache.do.back();

    await expect(app.trails.card(0).locators.summary).toContainText(
      '10 caches',
    );
  });

  test('ignored, it leaves its trail too', async ({ on, page }) => {
    const app = on(page);
    await app.trails.do.search('GCE2B06');
    await app.trails.do.openSearchResult();

    await app.cache.do.ignore();
    await app.cache.do.back();

    await expect(app.trails.card(0).locators.summary).toContainText(
      '10 caches',
    );
  });
});

test.describe('changing your mind about a cache', () => {
  test('a find marked by mistake is undone from its toast', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.trails.do.search('GCE2B06');
    await app.trails.do.openSearchResult();
    await app.cache.do.markFound();
    await expect(app.toast()).toHaveText(/GCE2B06 marked as found/);

    await app.toast.do.undo();
    await app.cache.do.back();

    await expect(app.trails.card(0).locators.summary).toContainText(
      '11 caches',
    );
  });

  test('an ignored cache is listed in the settings and can come back', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.trails.do.search('GCE2B06');
    await app.trails.do.openSearchResult();
    await app.cache.do.ignore();
    await app.cache.do.back();

    await app.settings.do.open();
    await expect(app.settings.locators.ignoredCaches).toHaveText([/GCE2B06/]);
    await app.settings.do.unignore('GCE2B06');
    await app.settings.do.close();

    await expect(app.trails.card(0).locators.summary).toContainText(
      '11 caches',
    );
  });

  test('every find marked here is forgotten at once from the settings', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.trails.do.search('GCE2B06');
    await app.trails.do.openSearchResult();
    await app.cache.do.markFound();
    await app.cache.do.back();

    await app.settings.do.open();
    await app.settings.do.forgetLocallyFound();
    await app.settings.do.close();

    await expect(app.trails.card(0).locators.summary).toContainText(
      '11 caches',
    );
  });
});

test.describe('the map', () => {
  test("a trail's badge opens that trail", async ({ on, page }) => {
    const app = on(page);
    await expect(app.map.locators.badges).toHaveCount(2);

    await app.map.do.openTrailByBadge(0);

    await expect(app.trail.locators.rows).not.toHaveCount(0);
  });

  test('without tiles, the trails and the walk still work', async ({
    on,
    page,
  }) => {
    await failMapTiles(page);
    const app = on(page);
    await app.home.do.reload();

    await app.trails.do.openTrail(0);
    await app.trail.do.startWalk();

    await expect(app.walk.locators.progress).toHaveText('0/11');
  });

  test('keeps the hint hidden until asked', async ({ on, page }) => {
    const app = on(page);
    await app.trails.do.search('GCE2B01');
    await app.trails.do.openSearchResult();
    await expect(app.cache.locators.hint).toBeHidden();

    await app.cache.do.showHint();

    await expect(app.cache.locators.hint).toHaveText(
      'Under the synthetic stone',
    );
  });
});
