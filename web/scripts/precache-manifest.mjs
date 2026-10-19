// next.config.ts's adapter: once `next build` has written the export, lists out/_next/static for public/sw.js to precache, lazily loaded chunks included.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const MANIFEST = 'precache-manifest.json';

/** Every hashed asset under `<out>/_next/static`, as the URL path below the base path. */
function precacheAssets(out) {
  // Source maps exist only in coverage builds and no page loads them.
  return readdirSync(resolve(out, '_next', 'static'), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
    .map(
      (entry) =>
        `/${relative(out, resolve(entry.parentPath, entry.name)).split('\\').join('/')}`,
    )
    .sort();
}

/** Throws, naming the cause, unless `<out>/precache-manifest.json` lists every hashed asset: without it the worker cannot install. */
export function assertPrecacheManifest(out) {
  const path = resolve(out, MANIFEST);
  if (!existsSync(path)) {
    throw new Error(
      `${path} is missing, so the service worker cannot install and the app has no offline support. ` +
        'Build with `npm run build` (or `next build` with next.config.ts, whose adapterPath writes it); docs/how-to/developer-guide.md says why.',
    );
  }
  const listed = new Set(JSON.parse(readFileSync(path, 'utf8')));
  const missing = precacheAssets(out).filter((asset) => !listed.has(asset));
  if (missing.length > 0) {
    throw new Error(
      `${path} leaves out ${missing.length} assets of this build (${missing.slice(0, 3).join(', ')}…): rebuild with \`npm run build\`.`,
    );
  }
}

/** @type {import('next').NextAdapter} */
const precacheAdapter = {
  name: 'powertrailbuddy-precache-manifest',
  // Runs after the static export is written, so a plain `next build` cannot leave the manifest out.
  onBuildComplete({ projectDir }) {
    const out = resolve(projectDir, 'out');
    const assets = precacheAssets(out);
    writeFileSync(
      resolve(out, MANIFEST),
      `${JSON.stringify(assets, null, 2)}\n`,
    );
    console.log(`${MANIFEST}: ${assets.length} assets`);
  },
};

export default precacheAdapter;
