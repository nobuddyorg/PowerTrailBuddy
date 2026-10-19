import { expect } from '@playwright/test';

import { test as base } from './coverage';

import {
  collectForeignRequests,
  collectPageProblems,
  expectNoPageProblems,
  fakeMapTiles,
} from './helpers';
import { createPageTree } from './pages';

/** A function of `page`, not a tree, so a spec with a second browser context can point it there. */
export const test = base.extend<{
  on: typeof createPageTree;
  /** Lets requests to the routing server pass the foreign-request check; only the walking-routes spec sets it. */
  allowRouter: boolean;
  tiles: void;
  pageProblems: void;
  foreignRequests: void;
}>({
  allowRouter: [false, { option: true }],
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
      const problems = await collectPageProblems(page);
      await provide();
      expectNoPageProblems(problems);
    },
    { auto: true },
  ],
  // Automatic, so every journey (import, map, walk, share, export) proves that nothing leaves the device unless asked.
  foreignRequests: [
    async ({ context, baseURL, allowRouter }, provide) => {
      const foreign = collectForeignRequests(context, {
        origin: new URL(baseURL!).origin,
        allowRouter,
      });
      await provide();
      expect(foreign, 'requests to other origins').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
