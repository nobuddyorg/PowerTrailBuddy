// Takes docs/images/'s screenshots of the built export with the bundled sample data; run by hand after `npm run build` (`npm run screenshots`), results committed.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium, devices } from '@playwright/test';

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}/PowerTrailBuddy/`;
const imagesDirectory = new URL('../../docs/images/', import.meta.url);

// A plain land-coloured tile: the screenshots never fetch from the tile server, and the sample's area does not exist anyway.
const PLAIN_TILE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#f2efe9"/></svg>';

// About 120 m from the start of the sample's first trail, so the walk has a distance and a bearing to show.
const NEAR_THE_SAMPLE = { latitude: 50.6917, longitude: 9.5032, accuracy: 5 };

const PHONE = { ...devices['Pixel 7'], deviceScaleFactor: 2 };
const DESKTOP = {
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
};

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(BASE_URL)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${BASE_URL} did not answer; run \`npm run build\` first`);
}

async function openWithSample(browser, device) {
  const context = await browser.newContext({
    ...device,
    locale: 'en-GB',
    // The worker would fetch tiles itself; without it every tile request meets the route below.
    serviceWorkers: 'block',
    geolocation: NEAR_THE_SAMPLE,
    permissions: ['geolocation'],
  });
  await context.route(/^https:\/\/tile\.openstreetmap\.org\//, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: PLAIN_TILE,
    }),
  );
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.getByTestId('try-sample').click();
  await page.getByTestId('trail-card').first().waitFor();
  await page.getByTestId('import-summary-dismiss').click();
  return { context, page };
}

async function shoot(page, name) {
  // Leaflet's fly-to and the sheet's snap animate for a moment after the click.
  await page.waitForTimeout(800);
  await page.screenshot({
    path: fileURLToPath(new URL(name, imagesDirectory)),
  });
  console.log(`docs/images/${name}`);
}

async function phoneScreenshots(browser) {
  const { context, page } = await openWithSample(browser, PHONE);
  await shoot(page, 'phone-trails.png');

  await page.getByTestId('trail-card').first().click();
  await page.getByTestId('trail-detail').waitFor();
  await shoot(page, 'phone-trail.png');

  await page.getByTestId('start-walk').click();
  await page.getByTestId('walk-target').waitFor();
  await shoot(page, 'phone-walk.png');
  await context.close();

  const settings = await openWithSample(browser, PHONE);
  await settings.page.getByTestId('open-settings').click();
  await settings.page.getByTestId('settings-dialog').waitFor();
  await shoot(settings.page, 'phone-settings.png');
  await settings.context.close();
}

async function desktopScreenshots(browser) {
  const { context, page } = await openWithSample(browser, DESKTOP);
  await page.getByTestId('trail-card').first().click();
  await page.getByTestId('trail-detail').waitFor();
  await shoot(page, 'desktop-trail.png');
  await context.close();
}

mkdirSync(imagesDirectory, { recursive: true });
const server = spawn(
  'node',
  ['scripts/serve-export.mjs', String(PORT), '/PowerTrailBuddy'],
  { cwd: new URL('..', import.meta.url), stdio: 'ignore' },
);
try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  try {
    await desktopScreenshots(browser);
    await phoneScreenshots(browser);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
