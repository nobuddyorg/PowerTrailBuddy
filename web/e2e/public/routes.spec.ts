import { expect, test } from '../fixture';

import { fakeRouter } from '../helpers';
import { offset, pocketQueryZip } from '../pocketQuery';

test.use({ locale: 'en-GB', allowRouter: true });

// A motorway between the long trail's seventh and eighth cache: neither half reaches the ten caches a trail needs.
const MOTORWAY = offset(1040, 2000).longitude;

test.beforeEach(async ({ on, page }) => {
  const app = on(page);
  await app.home.do.open();
  await app.emptyState.do.importFiles([await pocketQueryZip()]);
  await app.home.do.dismissImportSummary();
});

test.describe('walking routes', () => {
  test('ask nothing until turned on, then split a trail at a barrier, and keep what they learnt', async ({
    on,
    page,
  }) => {
    const asked = await fakeRouter(page, { barrierLongitude: MOTORWAY });
    const app = on(page);
    await expect(app.trails.locators.count).toHaveText('2 trails');
    await expect(app.trails.locators.routeStatus).toHaveCount(0);
    expect(asked).toEqual([]);

    await app.settings.do.open();
    await app.settings.do.toggleWalkingRoutes();
    await app.settings.do.close();

    await expect(app.trails.locators.routeStatus).toHaveText(
      'Distances follow real footpaths.',
    );
    await expect(app.trails.locators.count).toHaveText('1 trail');
    await expect(app.trails.locators.routeAttribution).toContainText(
      'FOSSGIS routing',
    );
    expect(asked.length).toBeGreaterThan(0);
    for (const url of asked)
      expect(url).toMatch(
        /^https:\/\/routing\.openstreetmap\.de\/routed-foot\/table\/v1\/foot\//,
      );

    const askedBeforeReload = asked.length;
    await app.home.do.reload();
    await expect(app.trails.locators.routeStatus).toHaveText(
      'Distances follow real footpaths.',
    );
    await expect(app.trails.locators.count).toHaveText('1 trail');
    expect(asked).toHaveLength(askedBeforeReload);

    await app.settings.do.open();
    await app.settings.do.toggleWalkingRoutes();
    await app.settings.do.close();
    await expect(app.trails.locators.count).toHaveText('2 trails');
    await expect(app.trails.locators.routeStatus).toHaveCount(0);
  });

  test('forget what they learnt on Clear all data, and ask the same again after the next import', async ({
    on,
    page,
  }) => {
    const asked = await fakeRouter(page, { barrierLongitude: MOTORWAY });
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.toggleWalkingRoutes();
    await app.settings.do.close();
    await expect(app.trails.locators.routeStatus).toHaveText(
      'Distances follow real footpaths.',
    );
    const askedBeforeClear = [...asked];
    expect(askedBeforeClear.length).toBeGreaterThan(0);

    await app.data.do.open();
    await app.data.do.clearAll();
    await app.emptyState.do.importFiles([await pocketQueryZip()]);
    await app.home.do.dismissImportSummary();
    await app.settings.do.open();
    await app.settings.do.toggleWalkingRoutes();
    await app.settings.do.close();

    await expect(app.trails.locators.routeStatus).toHaveText(
      'Distances follow real footpaths.',
    );
    await expect(app.trails.locators.count).toHaveText('1 trail');
    expect(asked).toEqual([...askedBeforeClear, ...askedBeforeClear]);
  });

  test('say so when the routing server fails, and keep the estimated trails', async ({
    on,
    page,
  }) => {
    await fakeRouter(page, { barrierLongitude: MOTORWAY, failing: true });
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.toggleWalkingRoutes();
    await app.settings.do.close();

    await expect(app.trails.locators.routeStatus).toHaveText(
      "Walking routes couldn't be checked; distances are estimated.",
    );
    await expect(app.trails.locators.count).toHaveText('2 trails');
  });
});
