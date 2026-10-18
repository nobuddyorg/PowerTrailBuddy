// Modules under both mutation testing (stryker.config.mjs) and the per-file coverage floor (vitest.config.mts).
export const MUTATE_TARGETS = [
  'src/app/lib/geocache/parseGpx.ts',
  'src/app/lib/geocache/importFiles.ts',
  'src/app/lib/geocache/mergeCaches.ts',
  'src/app/lib/trails/geo.ts',
  'src/app/lib/trails/findTrails.ts',
  'src/app/lib/walk/walk.ts',
  'src/app/data/browserStorage.ts',
  'src/app/data/sharedFiles.ts',
  'src/app/env.ts',
  'src/app/i18n/translate.ts',
];
