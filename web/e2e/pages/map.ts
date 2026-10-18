import { expect, type Locator, type Page } from '@playwright/test';

import { panelOf } from './panel';

interface MapView {
  (): Locator;
  do: {
    openTrailByBadge(index: number): Promise<void>;
  };
  locators: {
    badges: Locator;
    position: Locator;
    tiles: Locator;
  };
}

/** The Leaflet map behind the panel, or above the walk. */
export function initMap(page: Page): MapView {
  const root = page.getByTestId('map');
  // Leaflet's own DOM (tiles, the divIcon badges, the position dot) is reached by class; caches are drawn on a canvas.
  const locators = {
    badges: root.locator('.ptb-badge'),
    position: root.locator('.ptb-position'),
    tiles: root.locator('img.leaflet-tile'),
  };
  const interactions = {
    openTrailByBadge: async (index: number) => {
      await locators.badges.nth(index).click();
      await expect(panelOf(page).getByTestId('trail-detail')).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
