// Lists out/_next/static for public/sw.js to precache on install, lazily loaded chunks included; run after `next build`.
import { readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const out = resolve(import.meta.dirname, '..', 'out');
const staticDirectory = resolve(out, '_next', 'static');

// Source maps exist only in coverage builds and no page loads them.
const assets = readdirSync(staticDirectory, {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
  .map(
    (entry) =>
      `/${relative(out, resolve(entry.parentPath, entry.name)).split('\\').join('/')}`,
  )
  .sort();

writeFileSync(
  resolve(out, 'precache-manifest.json'),
  `${JSON.stringify(assets, null, 2)}\n`,
);
console.log(`precache-manifest.json: ${assets.length} assets`);
