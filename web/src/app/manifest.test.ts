import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  readFileSync(
    new URL('../../public/site.webmanifest', import.meta.url),
    'utf8',
  ),
) as { scope: string; start_url: string; display: string };

describe('site.webmanifest', () => {
  // A static file cannot interpolate the base path; URLs relative to the manifest follow it to any origin.
  it('names its scope and start relative to itself, so it follows the base path', () => {
    expect(manifest.scope).toBe('./');
    expect(manifest.start_url).toBe(manifest.scope);
  });

  it('installs as a standalone app', () => {
    expect(manifest.display).toBe('standalone');
  });
});
