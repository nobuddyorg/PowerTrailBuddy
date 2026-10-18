import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadWorker, ORIGIN } from './sw.test-support';

// The manifest is a static file nothing imports; a bad icon set or share target only shows on a phone.
const publicDir = new URL('../../public/', import.meta.url);

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface ShareTarget {
  action: string;
  method: string;
  enctype: string;
  params: { files: { name: string; accept: string[] }[] };
}

const manifest = JSON.parse(
  readFileSync(new URL('site.webmanifest', publicDir), 'utf8'),
) as {
  name: string;
  short_name: string;
  scope: string;
  start_url: string;
  display: string;
  icons: ManifestIcon[];
  background_color?: string;
  theme_color?: string;
  share_target: ShareTarget;
};

// A PNG's IHDR sits at a fixed offset, so the real dimensions need no decoder dependency.
function pngSize(file: string): string {
  const png = readFileSync(new URL(file, publicDir));
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

const edge = (icon: ManifestIcon) => Number(icon.sizes.split('x')[0]);

const MANIFEST_URL = `${ORIGIN}/PowerTrailBuddy/site.webmanifest`;

describe('site.webmanifest', () => {
  it('installs as PowerTrailBuddy, a standalone app', () => {
    expect(manifest.name).toBe('PowerTrailBuddy');
    expect(manifest.short_name.length).toBeLessThanOrEqual(15);
    expect(manifest.display).toBe('standalone');
  });

  // A static file cannot interpolate the base path; URLs relative to the manifest follow it to any origin.
  it('names every URL relative to the manifest, so it follows the base path', () => {
    const urls = [
      manifest.scope,
      manifest.start_url,
      manifest.share_target.action,
      ...manifest.icons.map((icon) => icon.src),
    ];
    for (const url of urls) {
      expect(url.startsWith('/') || url.includes(':')).toBe(false);
    }
    expect(manifest.scope).toBe('./');
    expect(manifest.start_url).toBe(manifest.scope);
  });

  it('declares each icon at the size of a PNG that is actually there', () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(pngSize(icon.src)).toBe(icon.sizes);
    }
  });

  it('offers the sizes Android asks for: 192 and 512', () => {
    const sizes = manifest.icons
      .filter((icon) => icon.purpose !== 'maskable')
      .map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });

  it('offers a maskable icon so a launcher crops the padding, not the artwork', () => {
    const maskable = manifest.icons.filter(
      (icon) => icon.purpose === 'maskable',
    );
    expect(maskable.length).toBeGreaterThan(0);
    for (const icon of maskable) expect(edge(icon)).toBeGreaterThanOrEqual(512);
  });

  // Without one the splash screen is drawn on white, not the paper the icon sits on.
  it('names the background the splash screen is drawn on', () => {
    expect(manifest.background_color).toBe('#f3f5ef');
    expect(manifest.theme_color).toBe(manifest.background_color);
  });
});

describe('the icons outside the manifest', () => {
  it('has the 180px icon iOS asks for', () => {
    expect(pngSize('apple-touch-icon.png')).toBe('180x180');
  });

  // An ICONDIR header (reserved 0, type 1, count) then one 16-byte entry per image, width and height first.
  it('has a favicon.ico with a 16px and a 32px image', () => {
    const ico = readFileSync(new URL('favicon.ico', publicDir));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) =>
      ico.readUInt8(6 + 16 * index),
    );
    expect(sizes).toEqual([16, 32]);
  });
});

describe('the share target', () => {
  const target = manifest.share_target;
  const { worker } = loadWorker();

  it('is a multipart POST, the only form that carries files', () => {
    expect(target.method).toBe('POST');
    expect(target.enctype).toBe('multipart/form-data');
  });

  it('posts to the path the service worker receives shares at', () => {
    const action = new URL(target.action, MANIFEST_URL).href;
    expect(action).toBe(`${ORIGIN}/PowerTrailBuddy/share-target/`);
    expect(
      worker.strategyFor(
        { url: action, method: target.method, mode: 'navigate' },
        worker.WORKER,
      ),
    ).toBe('share');
  });

  it('sends the files in the field the service worker reads', () => {
    expect(target.params.files.map((param) => param.name)).toEqual([
      worker.SHARE_FILES_FIELD,
    ]);
  });

  // Android matches a shared file against these; a Pocket Query arrives as a zip, a single export as GPX, often typeless.
  it('accepts Pocket Query zips and GPX files by extension and by every type they arrive as', () => {
    expect(target.params.files[0].accept).toEqual([
      '.gpx',
      '.zip',
      'application/gpx+xml',
      'application/zip',
      'application/x-zip-compressed',
      'application/xml',
      'text/xml',
      'application/octet-stream',
    ]);
  });
});
