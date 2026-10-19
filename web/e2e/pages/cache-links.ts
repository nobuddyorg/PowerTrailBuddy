import { type Locator } from '@playwright/test';

export interface CacheLinks {
  (): Locator;
  do: {
    copyCoordinates(): Promise<void>;
  };
  locators: {
    buttons: {
      copy: Locator;
    };
    links: {
      cachePage: Locator;
      directions: Locator;
      navigate: Locator;
    };
  };
}

/** Every way to the real cache, wherever a cache is shown: the cache sheet, a trail's cache row, the walk. */
export function initCacheLinks(scope: Locator): CacheLinks {
  const root = scope.getByTestId('cache-links');
  const locators = {
    buttons: {
      copy: root.getByTestId('copy-coordinates'),
    },
    links: {
      cachePage: root.getByTestId('cache-page-link'),
      directions: root.getByTestId('cache-directions-link'),
      navigate: root.getByTestId('cache-navigate-link'),
    },
  };
  const interactions = {
    // What it led to is the toast's to show.
    copyCoordinates: async () => {
      await locators.buttons.copy.click();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
