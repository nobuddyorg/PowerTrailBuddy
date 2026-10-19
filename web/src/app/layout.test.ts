import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Runs from a <script> tag or a meta tag before React exists, so it is asserted as raw source text.
const layout = readFileSync(new URL('layout.tsx', import.meta.url), 'utf8');

const policy = layout.slice(
  layout.indexOf('const CONTENT_SECURITY_POLICY'),
  layout.indexOf('export default function RootLayout'),
);

describe('the Content-Security-Policy meta tag in layout.tsx', () => {
  // Privacy, enforced by the browser: imported cache data has no origin to be sent to but the opt-in routing server.
  it('lets the app fetch from its own origin and the routing server only', () => {
    expect(policy).toContain(
      "`connect-src 'self' https://routing.openstreetmap.de`,",
    );
  });

  it('loads images from the app and the OpenStreetMap tile server only', () => {
    expect(policy).toContain(
      "`img-src 'self' data: blob: https://tile.openstreetmap.org`,",
    );
  });

  it("loads scripts and workers from the app's own origin only", () => {
    expect(policy).toContain("`script-src 'self' 'unsafe-inline'`,");
    expect(policy).toContain("`worker-src 'self'`,");
  });

  it('blocks plugin/object embeds outright', () => {
    expect(policy).toContain("`object-src 'none'`,");
  });

  it('is rendered before the scripts, so it covers everything that follows', () => {
    const cspRendered = layout.indexOf('httpEquiv="Content-Security-Policy"');
    const framebustRendered = layout.indexOf('FRAMEBUST_SCRIPT }}');
    expect(cspRendered).toBeGreaterThan(-1);
    expect(cspRendered).toBeLessThan(framebustRendered);
  });
});

describe('the framebusting script in layout.tsx', () => {
  it('breaks out by navigating the top frame when framed', () => {
    expect(layout).toContain('window.top!==window.self');
    expect(layout).toContain('window.top.location=window.self.location');
  });
});

describe('the language script in layout.tsx', () => {
  it('falls back to German, the default locale', () => {
    expect(layout).toContain("?l:'de'");
  });
});
