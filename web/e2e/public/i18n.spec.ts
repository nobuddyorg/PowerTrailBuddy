import { expect, test } from '../fixture';

import { pocketQueryZip } from '../pocketQuery';

const GERMAN_TITLE = 'Finde die besten Powertrails in deiner Nähe';
const ENGLISH_TITLE = 'Find the best power trails near you';

// Language is decided client-side; a wrong <html lang> mispronounces the page with no visible symptom.
test.describe('the language the app speaks', () => {
  test.describe('in a German browser', () => {
    test.use({ locale: 'de-DE' });

    test('follows a German browser', async ({ on, page }) => {
      await on(page).home.do.open();
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(on(page).emptyState.locators.title).toHaveText(GERMAN_TITLE);
    });

    test('describes the page in the language it is showing', async ({
      on,
      page,
    }) => {
      await on(page).home.do.open();
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /Pocket Quer/,
      );
    });

    test('counts in German once there is something to count', async ({
      on,
      page,
    }) => {
      const app = on(page);
      await app.home.do.open();
      await app.emptyState.do.importFiles([await pocketQueryZip()]);
      await expect(app.home.locators.importSummary).toHaveText(
        '28 Caches aus 1 Datei importiert.',
      );
      await expect(app.trails.locators.count).toHaveText('2 Trails');
    });
  });

  test.describe('in an English browser', () => {
    test.use({ locale: 'en-GB' });

    test('follows an English browser', async ({ on, page }) => {
      await on(page).home.do.open();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(on(page).emptyState.locators.title).toHaveText(
        ENGLISH_TITLE,
      );
    });

    test('lets a stored choice overrule the browser', async ({ on, page }) => {
      await page.addInitScript(() => localStorage.setItem('lang', 'de'));
      await on(page).home.do.open();
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(on(page).emptyState.locators.title).toHaveText(GERMAN_TITLE);
    });

    test('switches language from the header and keeps it', async ({
      on,
      page,
    }) => {
      const app = on(page);
      await app.home.do.open();
      await app.emptyState.do.importFiles([await pocketQueryZip()]);
      await expect(app.trails.locators.count).toHaveText('2 trails');

      await app.home.do.switchLanguage('de');
      await expect(app.trails.locators.count).toHaveText('2 Trails');
      await expect(app.home.locators.buttons.language('de')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await app.home.do.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(app.trails.locators.count).toHaveText('2 Trails');
    });
  });

  test.describe('in a Japanese browser', () => {
    test.use({ locale: 'ja-JP' });

    test('falls back to German for a language it does not speak', async ({
      on,
      page,
    }) => {
      await on(page).home.do.open();
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(on(page).emptyState.locators.title).toHaveText(GERMAN_TITLE);
      await expect(page.locator('body')).not.toContainText('empty.');
    });
  });
});
