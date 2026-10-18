import { expect, type Locator, type Page } from '@playwright/test';

import type { FilePayload } from '../pocketQuery';
import { panelOf } from './panel';

interface EmptyState {
  (): Locator;
  do: {
    importFiles(files: FilePayload[]): Promise<void>;
    trySample(): Promise<void>;
  };
  locators: {
    buttons: {
      trySample: Locator;
    };
    importInput: Locator;
    title: Locator;
  };
}

/** The first run, before anything is imported. */
export function initEmptyState(page: Page): EmptyState {
  const root = page.getByTestId('empty-state');
  const locators = {
    buttons: {
      trySample: root.getByTestId('try-sample'),
    },
    importInput: root.getByTestId('import-input'),
    title: root.getByTestId('empty-title'),
  };
  // An import that reads no cache leaves the empty state up; the summary says what happened either way.
  const imported = page.getByTestId('import-summary');
  const interactions = {
    importFiles: async (files: FilePayload[]) => {
      await locators.importInput.setInputFiles(files);
      await expect(imported).toBeVisible();
    },
    trySample: async () => {
      await locators.buttons.trySample.click();
      await expect(panelOf(page).getByTestId('trail-list')).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
