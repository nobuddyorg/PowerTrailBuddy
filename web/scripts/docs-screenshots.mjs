// Takes docs/images/'s screenshots of the built export on the real map, with SCREENSHOTS_DATA's Pocket Query or the sample; run by hand after `npm run build` (`npm run screenshots`), results committed.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium, devices } from '@playwright/test';

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}/PowerTrailBuddy/`;
const imagesDirectory = new URL('../../docs/images/', import.meta.url);
const DATA = process.env.SCREENSHOTS_DATA;

// About 120 m south of the walk's first cache, so the walk has a distance and a bearing to show.
const METERS_PER_DEGREE_OF_LATITUDE = 111_320;
const WALKER_OFFSET_METERS = 120;

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

async function importData(page) {
  if (DATA) {
    await page.getByTestId('import-input').setInputFiles(DATA);
  } else {
    await page.getByTestId('try-sample').click();
  }
  await page.getByTestId('trail-card').first().waitFor();
  await page.getByTestId('import-summary-dismiss').click();
}

async function openWithData(browser, device) {
  const context = await browser.newContext({
    ...device,
    locale: 'de-DE',
    // The worker would cache tiles and data between contexts; each screenshot starts from a fresh install.
    serviceWorkers: 'block',
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await importData(page);
  return { context, page };
}

async function standNearWalkTarget(context, page) {
  const link = await page
    .getByTestId('cache-navigate-link')
    .getAttribute('href');
  const [latitude, longitude] = /(-?\d+\.\d+),(-?\d+\.\d+)/
    .exec(decodeURIComponent(link))
    .slice(1)
    .map(Number);
  await context.setGeolocation({
    latitude: latitude - WALKER_OFFSET_METERS / METERS_PER_DEGREE_OF_LATITUDE,
    longitude,
    accuracy: 5,
  });
}

async function shoot(page, name) {
  // Leaflet's fly-to and the sheet's snap animate for a moment, and then fetch their tiles.
  await page.waitForTimeout(800);
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.leaflet-tile:not(.leaflet-tile-loaded)')
        .length === 0,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(400);
  await page.screenshot({
    path: fileURLToPath(new URL(name, imagesDirectory)),
  });
  console.log(`docs/images/${name}`);
}

async function phoneScreenshots(browser) {
  const { context, page } = await openWithData(browser, PHONE);
  await shoot(page, 'phone-trails.png');

  await page.getByTestId('trail-card').first().click();
  await page.getByTestId('trail-detail').waitFor();
  await shoot(page, 'phone-trail.png');

  await page.getByTestId('start-walk').click();
  await page.getByTestId('walk-target').waitFor();
  await standNearWalkTarget(context, page);
  await shoot(page, 'phone-walk.png');
  await context.close();

  const settings = await openWithData(browser, PHONE);
  await settings.page.getByTestId('open-settings').click();
  await settings.page.getByTestId('settings-dialog').waitFor();
  await shoot(settings.page, 'phone-settings.png');
  await settings.context.close();
}

async function desktopScreenshots(browser) {
  const { context, page } = await openWithData(browser, DESKTOP);
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
