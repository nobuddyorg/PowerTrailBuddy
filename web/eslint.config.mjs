import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import sonarjs from 'eslint-plugin-sonarjs';

const eslintConfig = [
  // Generated output and interrupted-run leftovers.
  {
    ignores: [
      'coverage/**',
      'coverage-e2e/**',
      '.stryker-tmp/**',
      'reports/**',
      'out/**',
      '.e2e-serve/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  // eslint-plugin-react's version auto-detection calls context.getFilename(), which ESLint 10 removed.
  {
    settings: { react: { version: '19.2.8' } },
  },
  // Type-aware linting for src/ only: e2e/ would need a second tsconfig.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}'],
  })),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // A mock standing in for an async API rarely needs to await anything.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/**/*.test-support.{ts,tsx}'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  // core-web-vitals already registers jsx-a11y (6 rules); redeclaring `plugins` errors, so only rules go here.
  {
    files: ['src/app/**/*.tsx'],
    ignores: ['src/app/**/*.test.tsx', 'src/app/**/*.test-support.tsx'],
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // Calls minimatch as a default export, which the minimatch@10 override lacks; axe covers form labels instead.
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },
  // Code-smell analysis for non-test source: a test's job is to be exhaustive, not non-repetitive.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/*.test-support.{ts,tsx}'],
    ...sonarjs.configs.recommended,
    // The recommended config sets a placeholder settings.react; a later `settings` replaces an earlier one wholesale.
    settings: { react: { version: '19.2.8' } },
    rules: {
      ...sonarjs.configs.recommended.rules,
      // Fires on every repeated Tailwind className string, not on duplicated logic.
      'sonarjs/no-duplicate-string': 'off',
      // Flags `void promise`, the very fix @typescript-eslint/no-floating-promises asks for.
      'sonarjs/void-use': 'off',
      // Would wrap every props type in `Readonly<...>`, a house style adopted nowhere yet.
      'sonarjs/prefer-read-only-props': 'off',
      // 20: CollectionBuddy's tuned value; cognitive-complexity is reviewed, not gamed.
      'sonarjs/cognitive-complexity': ['warn', 20],
    },
  },
  // Mirrors depcruise's storage-behind-data-layer for static imports, in the editor; depcruise also sees import().
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/data/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['idb-keyval', 'idb-keyval/*'],
              message:
                'Only data/ touches IndexedDB -- add what you need to data/store.ts and import that instead.',
            },
          ],
        },
      ],
    },
  },
  // Mirrors depcruise's leaflet-behind-map: one wrapper owns the third-party map DOM.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/data/**', 'src/app/components/Map/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['idb-keyval', 'idb-keyval/*'],
              message:
                'Only data/ touches IndexedDB -- add what you need to data/store.ts and import that instead.',
            },
            {
              group: ['leaflet', 'leaflet/*'],
              message:
                'Only components/Map/ imports Leaflet -- pass plain coordinates to the Map component instead.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
