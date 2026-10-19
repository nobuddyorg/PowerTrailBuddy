import { expect, type Locator, type Page } from '@playwright/test';

type Language = 'de' | 'en';

interface Home {
  (): Locator;
  do: {
    open(path?: string): Promise<void>;
    reload(): Promise<void>;
    dismissImportSummary(): Promise<void>;
    switchLanguage(language: Language): Promise<void>;
  };
  locators: {
    buttons: {
      data: Locator;
      install: Locator;
      settings: Locator;
      language(language: Language): Locator;
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
  const locators = {
    buttons: {
      data: root.getByTestId('open-data'),
      install: root.getByTestId('install-app'),
      settings: root.getByTestId('open-settings'),
      language: (language: Language) =>
        root.getByTestId(`language-${language}`),
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
      await page.reload({ waitUntil: 'networkidle' });
      await screens.first().waitFor();
    },
    dismissImportSummary: async () => {
      await root.getByTestId('import-summary-dismiss').click();
      await expect(locators.importSummary).toBeHidden();
    },
    switchLanguage: async (language: Language) => {
      await locators.buttons.language(language).click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
