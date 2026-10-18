import { test } from '../fixture';

import { expectNoSeriousA11yViolations } from '../axe';
import { placeDevice } from '../helpers';
import { offset, pocketQueryZip } from '../pocketQuery';

// Pinned, so a locale switch is not scanned as a second accessibility state.
test.use({ locale: 'en-GB' });

test.describe('accessibility', () => {
  test('the first run', async ({ on, page }, testInfo) => {
    await on(page).home.do.open();
    await expectNoSeriousA11yViolations(page, testInfo);
  });

  test.describe('with trails imported', () => {
    test.beforeEach(async ({ on, page }) => {
      const app = on(page);
      await app.home.do.open();
      await app.emptyState.do.importFiles([await pocketQueryZip()]);
      await app.home.do.dismissImportSummary();
    });

    test('the trail list', async ({ page }, testInfo) => {
      await expectNoSeriousA11yViolations(page, testInfo);
    });

    test('a trail', async ({ on, page }, testInfo) => {
      await on(page).trails.do.openTrail(0);
      await on(page).trail.row(0).do.expand();
      await expectNoSeriousA11yViolations(page, testInfo);
    });

    test('a cache', async ({ on, page }, testInfo) => {
      await on(page).trails.do.search('GCE2B01');
      await on(page).trails.do.openSearchResult();
      await expectNoSeriousA11yViolations(page, testInfo);
    });

    test('the settings dialog', async ({ on, page }, testInfo) => {
      await on(page).settings.do.open();
      await expectNoSeriousA11yViolations(page, testInfo);
    });

    test('the data dialog', async ({ on, page }, testInfo) => {
      await on(page).data.do.open();
      await expectNoSeriousA11yViolations(page, testInfo);
    });
  });

  test.describe('on a walk', () => {
    test.beforeEach(async ({ on, page, context }) => {
      await placeDevice(context, offset(-10));
      const app = on(page);
      await app.home.do.open();
      await app.emptyState.do.importFiles([await pocketQueryZip()]);
      await app.home.do.dismissImportSummary();
      await app.trails.do.openTrail(0);
      await app.trail.do.startAtNearestEnd();
    });

    test('the walk, close to a cache', async ({ on, page }, testInfo) => {
      await on(page).walk.locators.close.waitFor();
      await expectNoSeriousA11yViolations(page, testInfo);
    });

    test('the summary', async ({ on, page }, testInfo) => {
      await on(page).walk.do.found();
      await on(page).walk.do.finish();
      await expectNoSeriousA11yViolations(page, testInfo);
    });
  });
});
