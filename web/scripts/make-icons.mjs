// Renders public/'s icons from public/logo.svg with Playwright's Chromium; run by hand (`node scripts/make-icons.mjs`), results committed.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const publicDirectory = new URL('../public/', import.meta.url);
const source = readFileSync(new URL('logo.svg', publicDirectory));
const dataUri = `data:image/svg+xml;base64,${source.toString('base64')}`;

// site.webmanifest `background_color`; opaque because iOS composites a transparent icon onto black.
const PAPER = '#f3f5ef';

// A maskable icon may be cropped to the inner 80% circle, so the square artwork's diagonal is what has to fit.
const SQUARE_SPAN = 0.78;
const SAFE_CIRCLE = 0.8;
const FULL_SPAN = 1;

const artworkWidth = (size, fit) =>
  ({
    square: size * SQUARE_SPAN,
    circle: (size * SAFE_CIRCLE) / Math.SQRT2,
    full: size * FULL_SPAN,
  })[fit];

const targets = [
  // The two sizes Android looks for: home screen, then splash screen and install prompt.
  { file: 'icon-192.png', size: 192, fit: 'square', background: PAPER },
  { file: 'icon-512.png', size: 512, fit: 'square', background: PAPER },
  {
    file: 'icon-maskable-512.png',
    size: 512,
    fit: 'circle',
    background: PAPER,
  },
  // iOS asks for exactly 180 and scales it itself.
  { file: 'apple-touch-icon.png', size: 180, fit: 'square', background: PAPER },
  // A browser tab supplies its own background, and at this size every pixel of artwork counts.
  {
    file: 'favicon-32x32.png',
    size: 32,
    fit: 'full',
    background: 'transparent',
  },
];

// For a machine whose preinstalled Chromium is not the revision this Playwright pins (as in playwright.config.ts).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function renderSquare({ size, fit, background }) {
  const width = artworkWidth(size, fit);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;background:${background};display:flex;align-items:center;justify-content:center">
       <img src="${dataUri}" style="width:${width}px;height:${width}px;display:block">
     </body>`,
  );
  await page.locator('img').waitFor({ state: 'visible' });
  return page.screenshot({
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: background === 'transparent',
  });
}

const rendered = new Map();
for (const target of targets) {
  const png = await renderSquare(target);
  rendered.set(target.size, png);
  writeFileSync(new URL(target.file, publicDirectory), png);
  console.log(
    `${target.file}: ${target.size}x${target.size}, artwork ${Math.round(artworkWidth(target.size, target.fit))}px`,
  );
}

// An ICONDIR header, one ICONDIRENTRY per image, then the raw PNG bytes.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2); // color count: not palette-based
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const favicon16 = await renderSquare({
  size: 16,
  fit: 'full',
  background: 'transparent',
});
const ico = buildIco([
  { size: 16, png: favicon16 },
  { size: 32, png: rendered.get(32) },
]);
writeFileSync(new URL('favicon.ico', publicDirectory), ico);
console.log(`favicon.ico: 16px + 32px, ${ico.length} bytes`);

await browser.close();
