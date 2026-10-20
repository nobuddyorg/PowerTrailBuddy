import {
  expect,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';

import { initCacheLinks, type CacheLinks } from './cache-links';

interface WalkSummary {
  (): Locator;
  do: {
    backToTrails(): Promise<void>;
    exportFieldNotes(): Promise<Download>;
    resume(): Promise<void>;
    undo(): Promise<void>;
  };
  locators: {
    buttons: {
      done: Locator;
      exportNotes: Locator;
      resume: Locator;
      undo: Locator;
    };
    text: Locator;
    title: Locator;
  };
}

interface Walk {
  (): Locator;
  do: {
    dnf(): Promise<void>;
    finish(): Promise<void>;
    found(): Promise<void>;
    reverse(): Promise<void>;
    showHint(): Promise<void>;
    skip(): Promise<void>;
    undo(): Promise<void>;
  };
  locators: {
    buttons: {
      dnf: Locator;
      finish: Locator;
      found: Locator;
      reverse: Locator;
      skip: Locator;
      undo: Locator;
    };
    close: Locator;
    distance: Locator;
    heading: Locator;
    hint: Locator;
    links: CacheLinks;
    locationMessage: Locator;
    progress: Locator;
    target: Locator;
    targetCode: Locator;
  };
  summary: WalkSummary;
}

function initSummary(page: Page, scope: Locator): WalkSummary {
  const root = scope.getByTestId('walk-summary');
  const locators = {
    buttons: {
      done: root.getByTestId('walk-done'),
      exportNotes: root.getByTestId('export-field-notes'),
      resume: root.getByTestId('walk-resume'),
      undo: root.getByTestId('summary-undo'),
    },
    text: root.getByTestId('walk-summary-text'),
    title: root.getByTestId('walk-summary-title'),
  };
  const interactions = {
    backToTrails: async () => {
      await locators.buttons.done.click();
      await expect(scope).toBeHidden();
    },
    exportFieldNotes: async () => {
      const download = page.waitForEvent('download');
      await locators.buttons.exportNotes.click();
      return download;
    },
    resume: async () => {
      await locators.buttons.resume.click();
      await expect(scope.getByTestId('walk-target')).toBeVisible();
    },
    undo: async () => {
      await locators.buttons.undo.click();
      await expect(scope.getByTestId('walk-target')).toBeVisible();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}

/** The guided walk, from the first cache to the summary. */
export function initWalk(page: Page): Walk {
  const root = page.getByTestId('walk-view');
  const target = root.getByTestId('walk-target');
  const locators = {
    buttons: {
      dnf: target.getByTestId('walk-dnf'),
      finish: root.getByTestId('walk-finish'),
      found: target.getByTestId('walk-found'),
      reverse: root.getByTestId('walk-reverse'),
      skip: target.getByTestId('walk-skip'),
      undo: target.getByTestId('walk-undo'),
    },
    close: target.getByTestId('walk-close'),
    distance: target.getByTestId('walk-distance'),
    heading: target.getByRole('heading', { level: 2 }),
    hint: target.getByTestId('hint'),
    links: initCacheLinks(target),
    locationMessage: target.getByTestId('walk-location'),
    progress: root.getByTestId('walk-progress'),
    target,
    targetCode: target.getByTestId('walk-target-code'),
  };
  // Each record moves the progress on (or back), which is when the next target is up.
  const changingProgress = async (button: Locator) => {
    const before = await locators.progress.textContent();
    await button.click();
    await expect(locators.progress).not.toHaveText(before!);
  };
  const changingTarget = async (button: Locator) => {
    const before = await locators.targetCode.textContent();
    await button.click();
    await expect(locators.targetCode).not.toHaveText(before!);
  };
  const interactions = {
    dnf: () => changingProgress(locators.buttons.dnf),
    finish: async () => {
      await locators.buttons.finish.click();
      await expect(root.getByTestId('walk-summary')).toBeVisible();
    },
    found: () => changingProgress(locators.buttons.found),
    reverse: () => changingTarget(locators.buttons.reverse),
    showHint: async () => {
      await target.getByTestId('hint-toggle').click();
      await expect(locators.hint).toBeVisible();
    },
    skip: () => changingProgress(locators.buttons.skip),
    undo: () => changingProgress(locators.buttons.undo),
  };
  return Object.assign(() => root, {
    locators,
    do: interactions,
    summary: initSummary(page, root),
  });
}
