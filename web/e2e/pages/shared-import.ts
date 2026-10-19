import { expect, type Locator, type Page } from '@playwright/test';

interface SharedImport {
  (): Locator;
  do: {
    accept(): Promise<void>;
    cancel(): Promise<void>;
  };
  locators: {
    buttons: {
      accept: Locator;
      cancel: Locator;
    };
    files: Locator;
  };
}

/** The question a share to the app asks before anything is imported. */
export function initSharedImport(page: Page): SharedImport {
  const root = page.getByTestId('shared-import-dialog');
  const locators = {
    buttons: {
      accept: root.getByTestId('shared-import-accept'),
      cancel: root.getByTestId('shared-import-cancel'),
    },
    files: root.getByTestId('shared-file'),
  };
  const interactions = {
    accept: async () => {
      await locators.buttons.accept.click();
      await expect(root).toBeHidden();
    },
    cancel: async () => {
      await locators.buttons.cancel.click();
      await expect(root).toBeHidden();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
