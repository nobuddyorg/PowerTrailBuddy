import { afterEach, describe, expect, it, vi } from 'vitest';

import { basePath, withBasePath } from './env';

describe('the base path', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is empty when the app is served from the root', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', undefined);

    expect(basePath()).toBe('');
    expect(withBasePath('/sw.js')).toBe('/sw.js');
  });

  it('prefixes a path when the app is served from a subdirectory', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/repo');

    expect(basePath()).toBe('/repo');
    expect(withBasePath('/sw.js')).toBe('/repo/sw.js');
    expect(withBasePath('/')).toBe('/repo/');
  });
});
