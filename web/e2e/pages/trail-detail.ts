import {
  expect,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';

import { initCacheLinks, type CacheLinks } from './cache-links';
import { panelOf } from './panel';

interface TrailCacheRow {
  (): Locator;
  do: {
    expand(): Promise<void>;
    showOnMap(): Promise<void>;
  };
  locators: {
    facts: Locator;
    links: CacheLinks;
    toggle: Locator;
  };
}

interface TrailDetail {
  (): Locator;
  do: {
    back(): Promise<void>;
    exportGpx(): Promise<Download>;
    reverse(): Promise<void>;
    startAtNearestEnd(): Promise<void>;
    startWalk(): Promise<void>;
  };
  locators: {
    buttons: {
      back: Locator;
      exportGpx: Locator;
      reverse: Locator;
      startNearest: Locator;
      startWalk: Locator;
    };
    parking: Locator;
    rows: Locator;
    title: Locator;
  };
  /** One stop, by its place in the walking order shown (0 is the first). */
  row(index: number): TrailCacheRow;
}

function initRow(page: Page, root: Locator): TrailCacheRow {
  const locators = {
    facts: root.getByTestId('trail-cache-facts'),
    links: initCacheLinks(root),
    toggle: root.getByTestId('trail-cache-toggle'),
  };
  const interactions = {
    expand: async () => {
      await locators.toggle.click();
      await expect(locators.toggle).toHaveAttribute('aria-expanded', 'true');
    },
    showOnMap: async () => {
      await root.getByTestId('trail-cache-open').click();
      await expect(panelOf(page).getByTestId('cache-details')).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}

/** One trail in full, opened from the list or the map. */
export function initTrailDetail(page: Page): TrailDetail {
  const root = panelOf(page).getByTestId('trail-detail');
  const locators = {
    buttons: {
      back: root.getByTestId('trail-back'),
      exportGpx: root.getByTestId('export-gpx'),
      reverse: root.getByTestId('reverse-trail'),
      startNearest: root.getByTestId('start-nearest'),
      startWalk: root.getByTestId('start-walk'),
    },
    parking: root.getByTestId('trail-parking'),
    rows: root.getByTestId('trail-cache'),
    title: root.getByTestId('trail-detail-title'),
  };
  const walkView = page.getByTestId('walk-view');
  const interactions = {
    back: async () => {
      await locators.buttons.back.click();
      await expect(root).toBeHidden();
    },
    exportGpx: async () => {
      const download = page.waitForEvent('download');
      await locators.buttons.exportGpx.click();
      return download;
    },
    reverse: async () => {
      const pressed =
        await locators.buttons.reverse.getAttribute('aria-pressed');
      await locators.buttons.reverse.click();
      await expect(locators.buttons.reverse).not.toHaveAttribute(
        'aria-pressed',
        pressed!,
      );
    },
    startAtNearestEnd: async () => {
      await locators.buttons.startNearest.click();
      await expect(walkView).toBeVisible();
    },
    startWalk: async () => {
      await locators.buttons.startWalk.click();
      await expect(walkView).toBeVisible();
    },
  };
  const row = (index: number) => initRow(page, locators.rows.nth(index));
  return Object.assign(() => root, { locators, do: interactions, row });
}
