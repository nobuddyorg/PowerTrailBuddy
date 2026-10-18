import { type Page } from '@playwright/test';

/** The trail list, a trail and a cache share one panel: beside the map on a wide screen, a bottom sheet on a phone. */
export function panelOf(page: Page) {
  return page.getByTestId('side-panel').or(page.getByTestId('bottom-sheet'));
}
