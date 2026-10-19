import { expect, test } from '../fixture';

import { pocketQueryZip } from '../pocketQuery';

test.use({ locale: 'en-GB' });

test.beforeEach(async ({ on, page }) => {
  const app = on(page);
  await app.home.do.open();
  await app.emptyState.do.importFiles([await pocketQueryZip()]);
  await app.home.do.dismissImportSummary();
});

test.describe('the trail settings', () => {
  test('a larger minimum hides the smaller trail, and stays set', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.change({ minCaches: '12' });
    await app.settings.do.apply();

    await expect(app.trails.locators.count).toHaveText('1 trail');
    await expect(app.trails.card(0).locators.summary).toContainText(
      '14 caches',
    );

    await app.home.do.reload();
    await expect(app.trails.locators.count).toHaveText('1 trail');
    await app.settings.do.open();
    await expect(app.settings.locators.field('minCaches')).toHaveValue('12');
  });

  test('another cache type joins the trail it lies on', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.toggleCacheType('mystery');
    await app.settings.do.apply();

    await expect(app.trails.card(1).locators.summary).toContainText(
      '15 caches',
    );
  });

  test('a strict preset can leave no trail, and the list leads back', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.choosePreset('classic');
    await app.settings.do.apply();
    await expect(app.trails.locators.count).toHaveText('0 trails');

    await app.trails.do.openSettings();
    await app.settings.do.resetToDefaults();
    await expect(app.settings.locators.field('minCaches')).toHaveValue('10');
    await app.settings.do.apply();
    await expect(app.trails.locators.count).toHaveText('2 trails');
  });

  test('cancelling changes nothing', async ({ on, page }) => {
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.change({ minCaches: '12' });
    await app.settings.do.close();

    await expect(app.trails.locators.count).toHaveText('2 trails');
  });

  test('Escape cancels too, and hands focus back to the settings button', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.settings.do.open();
    await app.settings.do.change({ minCaches: '12' });
    await app.settings.do.dismissWithEscape();

    await expect(app.trails.locators.count).toHaveText('2 trails');
    await expect(app.home.locators.buttons.settings).toBeFocused();
  });

  test('fills the whole screen on a phone', async ({ on, page, isMobile }) => {
    test.skip(!isMobile, 'a sheet over the app on a wider screen');
    const app = on(page);
    await app.settings.do.open();

    expect(await app.settings().boundingBox()).toEqual({
      x: 0,
      y: 0,
      ...page.viewportSize(),
    });
  });
});
