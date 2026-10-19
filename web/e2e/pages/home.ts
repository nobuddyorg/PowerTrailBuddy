import { expect, type Locator, type Page } from '@playwright/test';

interface Home {
  (): Locator;
  do: {
    open(path?: string): Promise<void>;
    reload(): Promise<void>;
    dismissImportSummary(): Promise<void>;
  };
  locators: {
    buttons: {
      data: Locator;
      settings: Locator;
    };
    errorNotice: Locator;
    importSummary: Locator;
    refusedFiles: Locator;
    offline: Locator;
    title: Locator;
  };
}

/** The app shell: the header over every screen, and the notices under it. */
export function initHome(page: Page): Home {
  const root = page.getByTestId('home');
  const screens = root
    .getByTestId('empty-state')
    .or(root.getByTestId('side-panel'))
    .or(root.getByTestId('bottom-sheet'))
    .or(root.getByTestId('walk-view'));
  const map = root.getByTestId('map');
  const locators = {
    buttons: {
      data: root.getByTestId('open-data'),
      settings: root.getByTestId('open-settings'),
    },
    errorNotice: root.getByTestId('error-notice'),
    importSummary: root.getByTestId('import-summary'),
    refusedFiles: root.getByTestId('import-file'),
    offline: root.getByTestId('offline'),
    title: root.getByTestId('home-title'),
  };
  const interactions = {
    // Done once stored data has loaded and one of the three screens has replaced the loading status.
    open: async (path = '') => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await screens.first().waitFor();
    },
    reload: async () => {
      // A reload aborts the lazily loaded Leaflet still in flight, and Firefox logs the worker's lost answer; networkidle, reached at the first load, no longer waits.
      if ((await map.count()) > 0)
        await expect(map).toHaveClass(/leaflet-container/);
      await page.reload({ waitUntil: 'networkidle' });
      await screens.first().waitFor();
    },
    dismissImportSummary: async () => {
      await root.getByTestId('import-summary-dismiss').click();
      await expect(locators.importSummary).toBeHidden();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
