import type { KnipConfig } from 'knip';

// Only what Knip's static analysis cannot follow: a string inside another tool's config, or a subprocess binary.
const config: KnipConfig = {
  entry: [
    // Named only as a string in next.config.ts's `adapterPath`.
    'scripts/precache-manifest.mjs',
    // Named only as a string in stryker.config.mjs's `configFile`.
    'vitest.mutation.config.mts',
    // Loaded by the browser via navigator.serviceWorker.register(), never imported.
    'public/sw.js',
  ],
  // An export its own module also uses is a deliberate test seam; `knip --production` flags only test-only code.
  ignoreExportsUsedInFile: true,
};

export default config;
