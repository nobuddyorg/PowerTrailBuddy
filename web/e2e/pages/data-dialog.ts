import { expect, type Locator, type Page } from '@playwright/test';

import type { FilePayload } from '../pocketQuery';

interface DataDialog {
  (): Locator;
  do: {
    clearAll(): Promise<void>;
    close(): Promise<void>;
    importFiles(files: FilePayload[]): Promise<void>;
    open(): Promise<void>;
  };
  locators: {
    buttons: {
      clear: Locator;
      close: Locator;
    };
    counts: {
      caches: Locator;
      ignored: Locator;
      locallyFound: Locator;
      trails: Locator;
    };
    importInput: Locator;
    lastImport: Locator;
  };
}

/** What is stored on this device: counts, importing more, and clearing it all. */
export function initDataDialog(page: Page): DataDialog {
  const root = page.getByTestId('data-dialog');
  const locators = {
    buttons: {
      clear: root.getByTestId('clear-data'),
      close: root.getByTestId('dialog-close').first(),
    },
    counts: {
      caches: root.getByTestId('data-caches'),
      ignored: root.getByTestId('data-ignored'),
      locallyFound: root.getByTestId('data-locally-found'),
      trails: root.getByTestId('data-trails'),
    },
    importInput: root.getByTestId('import-input'),
    lastImport: root.getByTestId('last-import'),
  };
  const confirm = page.getByTestId('confirm-dialog');
  const interactions = {
    // Answers the confirmation too: an action spanning two dialogs belongs to the one that starts it.
    clearAll: async () => {
      await locators.buttons.clear.click();
      await confirm.getByTestId('confirm-accept').click();
      await expect(root).toBeHidden();
      await expect(page.getByTestId('empty-state')).toBeVisible();
    },
    close: async () => {
      await locators.buttons.close.click();
      await expect(root).toBeHidden();
    },
    // The dialog closes as the import starts; the summary is the import's own postcondition.
    importFiles: async (files: FilePayload[]) => {
      await locators.importInput.setInputFiles(files);
      await expect(root).toBeHidden();
      await expect(page.getByTestId('import-summary')).toBeVisible();
    },
    open: async () => {
      await page.getByTestId('open-data').click();
      await expect(root).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
