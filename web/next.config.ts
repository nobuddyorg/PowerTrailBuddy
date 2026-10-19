import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';
const repository = 'PowerTrailBuddy';

// The deploy passes the Pages site's URL, which has no path on a custom domain; other builds mimic the project URL.
const pagesUrl = process.env.PAGES_BASE_URL;

/** Where the export is served, which `next build` bakes into every asset URL. */
export const EXPORT_BASE_PATH =
  pagesUrl === undefined
    ? `/${repository}`
    : new URL(pagesUrl).pathname.replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // `next dev` serves from the root; the base path applies only to the deployed build.
  basePath: isProduction ? EXPORT_BASE_PATH : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isProduction ? EXPORT_BASE_PATH : '',
    // Versions the service worker's cache: a new build, a new cache, and the old builds' caches deleted.
    NEXT_PUBLIC_BUILD_ID: randomUUID(),
  },
  // Writes out/precache-manifest.json, which public/sw.js installs from, as the last step of every `next build`.
  adapterPath: resolve(__dirname, 'scripts/precache-manifest.mjs'),
  // Set only by the builds that feed e2e/coverage.ts; the deployed build must not ship source maps.
  productionBrowserSourceMaps: process.env.E2E_COVERAGE_SOURCEMAPS === 'true',
  turbopack: {
    resolveAlias: {
      // jszip's Node entry pulls in stream/util polyfills that try `Function()` at load, which the CSP blocks.
      jszip: { browser: 'jszip/dist/jszip.min.js' },
    },
  },
};

export default nextConfig;
