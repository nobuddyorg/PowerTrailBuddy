import { type Locator, type Page } from '@playwright/test';

interface Home {
  (): Locator;
  do: {
    open(): Promise<void>;
  };
  locators: {
    title: Locator;
  };
}

/** The start screen. */
export function initHome(page: Page): Home {
  const root = page.getByTestId('home');
  const locators = {
    title: root.getByTestId('home-title'),
  };
  const interactions = {
    open: async () => {
      await page.goto('', { waitUntil: 'networkidle' });
      await locators.title.waitFor();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
