import { test as base } from './coverage';

import {
  collectPageProblems,
  expectNoPageProblems,
  fakeMapTiles,
} from './helpers';
import { createPageTree } from './pages';

/** A function of `page`, not a tree, so a spec with a second browser context can point it there. */
export const test = base.extend<{
  on: typeof createPageTree;
  tiles: void;
  pageProblems: void;
}>({
  // Named provide, not use: inside a property called on, `use` reads to react-hooks/rules-of-hooks as a hook.
  on: async ({}, provide) => {
    await provide((page) => createPageTree(page));
  },
  // Automatic, so no spec can reach the real tile server by forgetting to ask for the fake.
  tiles: [
    async ({ page }, provide) => {
      await fakeMapTiles(page);
      await provide();
    },
    { auto: true },
  ],
  // Automatic, so a rejected background promise behind a passing assertion still fails the test.
  pageProblems: [
    async ({ page }, provide) => {
      const problems = collectPageProblems(page);
      await provide();
      expectNoPageProblems(problems);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
