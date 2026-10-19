import type { Page } from '@playwright/test';

import { expect, test } from '../fixture';
import { offerInstall } from '../helpers';

async function loadManifest(page: Page) {
  await page.goto('');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href, 'manifest link').toBeTruthy();
  const { status, body } = await page.evaluate(async (url) => {
    const response = await fetch(url as string);
    return { status: response.status, body: await response.json() };
  }, href);
  return { url: new URL(href!, page.url()), status, body };
}

/** The real width x height of a PNG, from its header. */
function pngSize(bytes: Buffer) {
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

// manifest.test.ts checks the file on disk; this checks what it links resolves at the deployed base path.
test.describe('the installable app', () => {
  test('links a manifest that the browser can fetch', async ({ page }) => {
    const { status, body } = await loadManifest(page);

    expect(status).toBe(200);
    expect(body.name).toBe('PowerTrailBuddy');
    expect(body.display).toBe('standalone');
    expect(body.background_color).toBe('#f3f5ef');
  });

  test('serves every icon it advertises, at the size it says', async ({
    page,
    request,
  }) => {
    const { url: manifestUrl, body } = await loadManifest(page);

    const icons: { src: string; sizes: string }[] = body.icons;
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      // A manifest's URLs resolve against the manifest, not the page that links it.
      const response = await request.get(new URL(icon.src, manifestUrl).href);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
      expect(pngSize(Buffer.from(await response.body())), icon.src).toBe(
        icon.sizes,
      );
    }
  });

  test('offers a maskable icon and one big enough for a splash screen', async ({
    page,
  }) => {
    const { body } = await loadManifest(page);
    const icons: { sizes: string; purpose?: string }[] = body.icons;
    const big = (icon: { sizes: string }) =>
      Number(icon.sizes.split('x')[0]) >= 512;
    expect(
      icons.filter((icon) => icon.purpose === 'maskable' && big(icon)),
    ).not.toEqual([]);
    expect(
      icons.filter((icon) => icon.purpose !== 'maskable' && big(icon)),
    ).not.toEqual([]);
  });

  test('serves the favicon and apple touch icon it links', async ({
    page,
    request,
  }) => {
    await page.goto('');
    for (const rel of ['icon', 'apple-touch-icon']) {
      const hrefs = await page
        .locator(`link[rel="${rel}"]`)
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(hrefs.length, rel).toBeGreaterThan(0);
      for (const href of hrefs) {
        const response = await request.get(new URL(href!, page.url()).href);
        expect(response.status(), href!).toBe(200);
      }
    }
  });

  // Relative in the file, so what matters is where they resolve at the deployed base path.
  test('scopes the manifest and its share target to where the app is served', async ({
    page,
    baseURL,
  }) => {
    const { url: manifestUrl, body } = await loadManifest(page);
    const appRoot = new URL(baseURL!).pathname;

    expect(new URL(body.scope, manifestUrl).pathname).toBe(appRoot);
    expect(new URL(body.start_url, manifestUrl).pathname).toBe(appRoot);
    expect(new URL(body.share_target.action, manifestUrl).pathname).toBe(
      `${appRoot}share-target/`,
    );
    expect(body.share_target.method).toBe('POST');
    expect(body.share_target.enctype).toBe('multipart/form-data');
    expect(body.share_target.params.files[0].name).toBe('files');
  });

  // Chromium offers the install once its criteria hold; the button keeps that offer and spends it.
  test('offers to install when the browser does, and only once', async ({
    on,
    page,
  }) => {
    const app = on(page);
    await app.home.do.open();
    await expect(app.home.locators.buttons.install).toBeHidden();

    await offerInstall(page);
    await app.home.locators.buttons.install.click();

    await expect(page.locator('html')).toHaveAttribute(
      'data-install-prompted',
      'yes',
    );
    await expect(app.home.locators.buttons.install).toBeHidden();
  });
});
