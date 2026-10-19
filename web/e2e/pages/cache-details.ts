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
    openSettingsFromReasons(): Promise<void>;
    startWalkHere(): Promise<void>;
  };
  locators: {
    buttons: {
      back: Locator;
      ignore: Locator;
      markFound: Locator;
      reasonsSettings: Locator;
      startWalkHere: Locator;
      trail: Locator;
      unignore: Locator;
      unmarkFound: Locator;
    };
    code: Locator;
    distance: Locator;
    health: Locator;
    hint: Locator;
    name: Locator;
    /** Why the cache is in no trail, one line per reason. */
    leftOutReasons: Locator;
    recentLogs: Locator;
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
      reasonsSettings: root.getByTestId('left-out-settings'),
      startWalkHere: root.getByTestId('start-walk-here'),
      trail: root.getByTestId('cache-trail'),
      unignore: root.getByTestId('unignore-cache'),
      unmarkFound: root.getByTestId('unmark-found'),
    },
    code: root.getByTestId('cache-code'),
    distance: root.getByTestId('cache-distance'),
    health: root.getByTestId('health-badge'),
    hint: root.getByTestId('hint'),
    name: root.getByRole('heading', { level: 2 }),
    leftOutReasons: root.getByTestId('left-out-reason'),
    recentLogs: root.getByTestId('recent-log'),
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
    openSettingsFromReasons: async () => {
      await locators.buttons.reasonsSettings.click();
      await expect(page.getByTestId('settings-dialog')).toBeVisible();
    },
    startWalkHere: async () => {
      await locators.buttons.startWalkHere.click();
      await expect(page.getByTestId('walk-view')).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
