import { expect, type Locator, type Page } from '@playwright/test';

interface Toast {
  (): Locator;
  do: {
    undo(): Promise<void>;
  };
  locators: {
    buttons: {
      action: Locator;
    };
  };
}

/** The short confirmation at the bottom of the screen, some with an Undo. */
export function initToast(page: Page): Toast {
  const root = page.getByTestId('toast');
  const locators = {
    buttons: {
      action: root.getByTestId('toast-action'),
    },
  };
  const interactions = {
    undo: async () => {
      await locators.buttons.action.click();
      await expect(root).toBeHidden();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
