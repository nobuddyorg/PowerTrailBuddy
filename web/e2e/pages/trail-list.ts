import { expect, type Locator, type Page } from '@playwright/test';

import { panelOf } from './panel';

type TrailSort = 'rate' | 'caches' | 'nearest' | 'shortest';
type TrailFilter = 'short' | 'quick' | 'near';

interface TrailCard {
  (): Locator;
  locators: {
    distance: Locator;
    health: Locator;
    name: Locator;
    summary: Locator;
  };
}

interface TrailList {
  (): Locator;
  do: {
    openSearchResult(index?: number): Promise<void>;
    openSettings(): Promise<void>;
    openTrail(index?: number): Promise<void>;
    search(term: string): Promise<void>;
    sortBy(sort: TrailSort): Promise<void>;
    toggleFilter(filter: TrailFilter): Promise<void>;
  };
  locators: {
    buttons: {
      filter(filter: TrailFilter): Locator;
      openSettings: Locator;
    };
    cacheCount: Locator;
    cards: Locator;
    count: Locator;
    inputs: {
      search: Locator;
      sort: Locator;
    };
    searchResults: Locator;
  };
  /** One card, by its place in the list as shown (0 is the top). */
  card(index: number): TrailCard;
}

function initCard(root: Locator): TrailCard {
  const locators = {
    distance: root.getByTestId('trail-distance'),
    health: root.getByTestId('trail-health'),
    name: root.getByTestId('trail-card-name'),
    summary: root.getByTestId('trail-card-summary'),
  };
  return Object.assign(() => root, { locators });
}

/** The panel's first view: imported caches, the search, and the ranked trails. */
export function initTrailList(page: Page): TrailList {
  const panel = panelOf(page);
  const root = panel.getByTestId('trail-list');
  const locators = {
    buttons: {
      filter: (filter: TrailFilter) =>
        root.getByTestId(`trail-filter-${filter}`),
      openSettings: root.getByTestId('trails-open-settings'),
    },
    cacheCount: panel.getByTestId('cache-count'),
    cards: root.getByTestId('trail-card'),
    count: root.getByTestId('trail-count'),
    inputs: {
      search: panel.getByRole('searchbox'),
      sort: root.getByTestId('trail-sort'),
    },
    searchResults: panel.getByTestId('search-result'),
  };
  const interactions = {
    openSearchResult: async (index = 0) => {
      await locators.searchResults.nth(index).click();
      await expect(panel.getByTestId('cache-details')).toBeVisible();
    },
    openSettings: async () => {
      await locators.buttons.openSettings.click();
      await expect(page.getByTestId('settings-dialog')).toBeVisible();
    },
    openTrail: async (index = 0) => {
      await locators.cards.nth(index).click();
      await expect(panel.getByTestId('trail-detail')).toBeVisible();
    },
    search: async (term: string) => {
      await locators.inputs.search.fill(term);
    },
    sortBy: async (sort: TrailSort) => {
      await locators.inputs.sort.selectOption(sort);
      await expect(locators.inputs.sort).toHaveValue(sort);
    },
    toggleFilter: async (filter: TrailFilter) => {
      const button = locators.buttons.filter(filter);
      const pressed = await button.getAttribute('aria-pressed');
      await button.click();
      await expect(button).not.toHaveAttribute('aria-pressed', pressed!);
    },
  };
  const card = (index: number) => initCard(locators.cards.nth(index));
  return Object.assign(() => root, { locators, do: interactions, card });
}
