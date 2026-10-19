// Walks the whole module graph, so it catches a component reaching IndexedDB or Leaflet through another module, which ESLint's per-file no-restricted-imports cannot.
const config = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'A cycle between modules makes both harder to reason about and to test in isolation.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment:
        'A module nothing imports and that imports nothing local is dead code -- ' +
        'CLAUDE.md rules that out explicitly. Test/spec files and .d.ts files are ' +
        'expected to be "orphans" in graph terms (they are run, not imported).',
      from: {
        orphan: true,
        pathNot: ['\\.(test|spec)\\.(ts|tsx)$', '\\.d\\.ts$'],
      },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment:
        'An import dependency-cruiser cannot resolve is usually a typo or a missing dependency.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'lib-is-pure',
      severity: 'error',
      comment:
        'src/app/lib/ is the pure core (parsing, geometry, trail finding, walk state): plain functions ' +
        'over values, so unit and mutation tests reach all of it without faking a browser. It never ' +
        'imports React, Next, Leaflet, IndexedDB, or any app module outside lib/ -- not even a ' +
        'top-level hook or dataCore.ts, which would reach React or IndexedDB in turn.',
      from: { path: '^src/app/lib/' },
      to: {
        path: [
          '^node_modules/(react|react-dom|next|leaflet|idb-keyval)/',
          '^src/app/',
        ],
        pathNot: '^src/app/lib/',
      },
    },
    {
      name: 'lib-no-node-core',
      severity: 'error',
      comment:
        'The pure core runs in the browser and in Node tests alike, so it never imports a Node ' +
        'built-in (node:fs, path, ...), not even from a test.',
      from: { path: '^src/app/lib/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'app-bundle-no-node-core',
      severity: 'error',
      comment:
        'src/app/ ships to the browser, which has no Node built-ins; only tests and their ' +
        'support files, which run in Node, may read a file. lib/ has its stricter rule above.',
      from: {
        path: '^src/app/',
        pathNot: ['^src/app/lib/', '\\.test(-support)?\\.(ts|tsx)$'],
      },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'storage-behind-data-layer',
      severity: 'error',
      comment:
        'Only src/app/data/ imports idb-keyval, so every byte the app keeps goes through one module ' +
        'whose keys are documented (docs/reference/architecture.md).',
      from: { path: '^src/app/', pathNot: '^src/app/data/' },
      to: { path: '^node_modules/idb-keyval/' },
    },
    {
      name: 'leaflet-behind-map',
      severity: 'error',
      comment:
        'Only src/app/components/Map/ imports Leaflet: one wrapper owns the third-party DOM and the tile URL.',
      from: { path: '^src/app/', pathNot: '^src/app/components/Map/' },
      to: { path: '^node_modules/leaflet/' },
    },
    {
      name: 'data-layer-only-lib',
      severity: 'error',
      comment:
        'The data-access layer is consumed by components and the top-level hooks, never the other ' +
        'way around: besides itself it imports only the pure core in lib/.',
      from: { path: '^src/app/data/' },
      to: { path: '^src/app/', pathNot: '^src/app/(data|lib)/' },
    },
    {
      name: 'i18n-no-app-deps',
      severity: 'error',
      comment:
        'Translation lookup is a leaf: it imports no other app module -- no data access, UI, ' +
        'top-level hook or lib/. The one exception is the localStorage shim that remembers the ' +
        'chosen language.',
      from: { path: '^src/app/i18n/' },
      to: {
        path: '^src/app/',
        pathNot: [
          '^src/app/i18n/',
          '^src/app/data/browserStorage(\\.test-support)?\\.ts$',
        ],
      },
    },
    {
      name: 'e2e-is-black-box',
      severity: 'error',
      comment:
        'e2e/ drives the app through a real browser and never imports app internals directly -- ' +
        'it has its own helpers (e2e/helpers.ts, e2e/axe.ts) instead of reaching into src/app.',
      from: { path: '^e2e/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'scripts-are-standalone',
      severity: 'error',
      comment:
        'web/scripts/** are Node tools that run outside the Next.js build (export server, ' +
        'mutation summary) and must not depend on browser-only app code.',
      from: { path: '^scripts/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'app-bundle-no-node-tooling',
      severity: 'error',
      comment:
        'The reverse of scripts-are-standalone: src/app/ is what ships in the static export, so it ' +
        'must never import from scripts/ or e2e/, which are Node-only and CI-only code.',
      from: { path: '^src/app/' },
      to: { path: '^(scripts|e2e)/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    // Type-only imports are erased at runtime but are real coupling; without this most sibling `types.ts` files misreport as orphans.
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    // A subpath that exists only in its package's `exports`, which the resolver skips by default.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    progress: { type: 'none' },
  },
};

export default config;
