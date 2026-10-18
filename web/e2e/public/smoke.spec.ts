import { expect, test } from '../fixture';

import { expectNoSeriousA11yViolations } from '../axe';
import {
  collectPageProblems,
  documentWidths,
  expectNoPageProblems,
} from '../helpers';

test.use({ locale: 'en-GB' });

// Prerendering runs in Node, so only a browser catches code that breaks as a bundle.
test.describe('the deployed bundle', () => {
  test('loads without throwing', async ({ on, page }) => {
    const problems = collectPageProblems(page);
    await on(page).home.do.open();
    await expect(page).toHaveTitle(/PowerTrailBuddy/);
    await expect(on(page).home.locators.title).toHaveText('PowerTrailBuddy');
    expectNoPageProblems(problems);
  });

  // A chunk or font missing under a wrong base path 404s without throwing.
  test('asks for nothing the host cannot serve', async ({ on, page }) => {
    const refused: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        refused.push(`${response.status()} ${response.url()}`);
      }
    });

    await on(page).home.do.open();
    expect(refused, 'requests the host refused').toEqual([]);
  });

  test('links the manifest under the base path', async ({ on, page }) => {
    await on(page).home.do.open();
    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    const response = await page.request.get(new URL(href!, page.url()).href);
    expect(response.ok()).toBe(true);
  });

  test('speaks German to a browser that asks for neither language', async ({
    browser,
    on,
  }) => {
    const context = await browser.newContext({ locale: 'fr-FR' });
    const page = await context.newPage();
    await on(page).home.do.open();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await context.close();
  });

  test('fits the screen without sideways scrolling', async ({ on, page }) => {
    await on(page).home.do.open();
    const { scrollWidth, clientWidth } = await documentWidths(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('has no serious accessibility violations', async ({
    on,
    page,
  }, testInfo) => {
    await on(page).home.do.open();
    await expectNoSeriousA11yViolations(page, testInfo);
  });
});
