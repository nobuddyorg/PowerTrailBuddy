import { type Page } from '@playwright/test';

import { initHome } from './home';

/** Getters, so a spec that wants one screen builds only that screen's locators. */
export function createPageTree(page: Page) {
  return {
    get home() {
      return initHome(page);
    },
  };
}
