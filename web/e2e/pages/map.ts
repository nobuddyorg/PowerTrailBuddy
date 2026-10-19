import { expect, type Locator, type Page } from '@playwright/test';

import { panelOf } from './panel';

interface MapView {
  (): Locator;
  do: {
    locate(): Promise<void>;
    openTrailByBadge(index: number): Promise<void>;
    zoomOut(): Promise<void>;
  };
  locators: {
    badges: Locator;
    locate: Locator;
    position: Locator;
    tiles: Locator;
    loadedTiles: Locator;
    zoomOut: Locator;
  };
  /** The zoom level the map has come to rest at. */
  settledZoom(): Promise<number>;
}

// Leaflet's own zoom animation takes 250 ms; a level seen twice this far apart is where the map rests.
const SETTLE_MS = 400;

// Leaflet writes the zoom into no attribute, but every tile's URL carries its level: one level once a zoom is over.
const TILE_LEVEL = /\/(\d+)\/\d+\/\d+\.png$/;

/** The Leaflet map behind the panel, or above the walk. */
export function initMap(page: Page): MapView {
  const root = page.getByTestId('map');
  // Leaflet's own DOM (tiles, the divIcon badges, the position dot) is reached by class; caches are drawn on a canvas.
  const locators = {
    badges: root.locator('.ptb-badge'),
    locate: page.getByTestId('locate'),
    position: root.locator('.ptb-position'),
    tiles: root.locator('img.leaflet-tile'),
    loadedTiles: root.locator('img.leaflet-tile-loaded'),
    zoomOut: root.locator('.leaflet-control-zoom-out'),
  };
  const tileLevel = async () => {
    const sources = await locators.loadedTiles.evaluateAll((tiles) =>
      tiles.map((tile) => (tile as HTMLImageElement).src),
    );
    const levels = new Set(sources.map((src) => TILE_LEVEL.exec(src)?.[1]));
    return levels.size === 1 ? Number([...levels][0]) : Number.NaN;
  };
  const settledZoom = async () => {
    let seen = Number.NaN;
    await expect
      .poll(
        async () => {
          const previous = seen;
          seen = await tileLevel();
          return seen === previous;
        },
        { intervals: [SETTLE_MS] },
      )
      .toBe(true);
    return seen;
  };
  const interactions = {
    locate: async () => {
      await locators.locate.click();
    },
    openTrailByBadge: async (index: number) => {
      await locators.badges.nth(index).click();
      await expect(panelOf(page).getByTestId('trail-detail')).toBeVisible();
    },
    zoomOut: async () => {
      const before = await settledZoom();
      await locators.zoomOut.click();
      await expect.poll(tileLevel).toBe(before - 1);
    },
  };
  return Object.assign(() => root, {
    locators,
    do: interactions,
    settledZoom,
  });
}
