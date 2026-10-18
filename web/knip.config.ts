import type { KnipConfig } from 'knip';

// Only what Knip's static analysis cannot follow: a string inside another tool's config, or a subprocess binary.
const config: KnipConfig = {
  entry: [
    // playwright.config.ts's `webServer.command` is a shell string.
    'scripts/serve-export.mjs',
    // Named only as a string in stryker.config.mjs's `configFile`.
    'vitest.mutation.config.mts',
    // Loaded by the browser via navigator.serviceWorker.register(), never imported.
    'public/sw.js',
  ],
};

export default config;
