import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../public/sw.js', import.meta.url),
  'utf8',
);

// sw.js is a plain script with no import path, so its decision functions are evaluated from raw source.
function extractFunction(name: string): string {
  const start = [`\nfunction ${name}(`, `\nasync function ${name}(`]
    .map((signature) => source.indexOf(signature))
    .find((index) => index >= 0);
  if (start === undefined) throw new Error(`${name} not found in sw.js`);
  const end = source.indexOf('\n}', start + 1) + 2;
  return source.slice(start + 1, end);
}

function load<T>(name: string, preamble = ''): T {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- sw.js exports nothing; evaluating its source is the only way in
  const factory = new Function(
    `${preamble}\n${extractFunction(name)}\nreturn ${name};`,
  ) as () => T;
  return factory();
}

const PREFIX = "const CACHE_PREFIX = 'powertrailbuddy-shell-';";

describe('cacheNameFor', () => {
  const cacheNameFor = load<(search: string) => string>('cacheNameFor', PREFIX);

  it('names one cache per build', () => {
    expect(cacheNameFor('?build=abc')).toBe('powertrailbuddy-shell-abc');
  });

  it('still names a cache for a worker registered without a build', () => {
    expect(cacheNameFor('')).toBe('powertrailbuddy-shell-unversioned');
  });
});

describe('isStaleCache', () => {
  const isStaleCache = load<(key: string, current: string) => boolean>(
    'isStaleCache',
    PREFIX,
  );

  it("deletes an older build's shell cache", () => {
    expect(
      isStaleCache('powertrailbuddy-shell-old', 'powertrailbuddy-shell-new'),
    ).toBe(true);
  });

  it('keeps the current build', () => {
    expect(
      isStaleCache('powertrailbuddy-shell-new', 'powertrailbuddy-shell-new'),
    ).toBe(false);
  });

  // The share target parks files there between the POST and the page that imports them.
  it('never deletes the shared-files cache', () => {
    expect(
      isStaleCache('powertrailbuddy-shared-files', 'powertrailbuddy-shell-new'),
    ).toBe(false);
  });

  it("never deletes another site's cache on the same origin", () => {
    expect(isStaleCache('collectionbuddy-1', 'powertrailbuddy-shell-new')).toBe(
      false,
    );
  });
});

describe('isHashedStaticAsset', () => {
  const isHashedStaticAsset = load<(pathname: string) => boolean>(
    'isHashedStaticAsset',
  );

  it('matches a content-hashed Next.js chunk', () => {
    expect(
      isHashedStaticAsset('/PowerTrailBuddy/_next/static/chunks/1.js'),
    ).toBe(true);
  });

  it('does not match the app shell or the manifest', () => {
    expect(isHashedStaticAsset('/PowerTrailBuddy/')).toBe(false);
    expect(isHashedStaticAsset('/PowerTrailBuddy/site.webmanifest')).toBe(
      false,
    );
  });
});

describe('isAppShellRequest', () => {
  const isAppShellRequest =
    load<(pathname: string, mode: string) => boolean>('isAppShellRequest');

  it('matches a navigation regardless of which page it lands on', () => {
    expect(isAppShellRequest('/PowerTrailBuddy/', 'navigate')).toBe(true);
  });

  it('matches the manifest even outside a navigation', () => {
    expect(isAppShellRequest('/PowerTrailBuddy/site.webmanifest', 'cors')).toBe(
      true,
    );
  });

  it('matches neither a hashed asset nor an unrelated request', () => {
    expect(
      isAppShellRequest('/PowerTrailBuddy/_next/static/chunks/1.js', 'cors'),
    ).toBe(false);
    expect(isAppShellRequest('/PowerTrailBuddy/favicon.ico', 'no-cors')).toBe(
      false,
    );
  });
});

describe('the fetch handler', () => {
  // Map tiles are the only cross-origin requests; this check alone keeps them out of the cache.
  it('never intercepts a cross-origin request', () => {
    expect(source).toContain('url.origin !== self.location.origin');
  });
});
