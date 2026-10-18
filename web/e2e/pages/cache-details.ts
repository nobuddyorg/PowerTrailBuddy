import { expect, type Locator, type Page } from '@playwright/test';

import { initCacheLinks, type CacheLinks } from './cache-links';
import { panelOf } from './panel';

interface CacheDetails {
  (): Locator;
  do: {
    back(): Promise<void>;
    ignore(): Promise<void>;
    markFound(): Promise<void>;
    showHint(): Promise<void>;
    openTrail(): Promise<void>;
  };
  locators: {
    buttons: {
      back: Locator;
      ignore: Locator;
      markFound: Locator;
      trail: Locator;
      unignore: Locator;
      unmarkFound: Locator;
    };
    code: Locator;
    distance: Locator;
    hint: Locator;
    links: CacheLinks;
  };
}

/** One cache in the panel, opened from the search, a trail's row or the map. */
export function initCacheDetails(page: Page): CacheDetails {
  const panel = panelOf(page);
  const root = panel.getByTestId('cache-details');
  const locators = {
    buttons: {
      back: panel.getByTestId('cache-back'),
      ignore: root.getByTestId('ignore-cache'),
      markFound: root.getByTestId('mark-found'),
      trail: root.getByTestId('cache-trail'),
      unignore: root.getByTestId('unignore-cache'),
      unmarkFound: root.getByTestId('unmark-found'),
    },
    code: root.getByTestId('cache-code'),
    distance: root.getByTestId('cache-distance'),
    hint: root.getByTestId('hint'),
    links: initCacheLinks(root),
  };
  const interactions = {
    back: async () => {
      await locators.buttons.back.click();
      await expect(root).toBeHidden();
    },
    ignore: async () => {
      await locators.buttons.ignore.click();
      await expect(locators.buttons.unignore).toBeVisible();
    },
    markFound: async () => {
      await locators.buttons.markFound.click();
      await expect(locators.buttons.unmarkFound).toBeVisible();
    },
    showHint: async () => {
      await root.getByTestId('hint-toggle').click();
      await expect(locators.hint).toBeVisible();
    },
    openTrail: async () => {
      await locators.buttons.trail.click();
      await expect(panel.getByTestId('trail-detail')).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
