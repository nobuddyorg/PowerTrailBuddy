import { expect, type Locator, type Page } from '@playwright/test';

type SettingField =
  | 'maxDifficulty'
  | 'maxTerrain'
  | 'maxGapMeters'
  | 'minCaches'
  | 'maxWalkKilometers'
  | 'walkingSpeedKmh'
  | 'minutesPerCache'
  | 'detourFactor';

type Preset = 'standard' | 'classic' | 'relaxed';

interface Settings {
  (): Locator;
  do: {
    apply(): Promise<void>;
    change(values: Partial<Record<SettingField, string>>): Promise<void>;
    choosePreset(preset: Preset): Promise<void>;
    close(): Promise<void>;
    dismissWithEscape(): Promise<void>;
    forgetLocallyFound(): Promise<void>;
    open(): Promise<void>;
    unignore(code: string): Promise<void>;
    toggleCacheType(type: string): Promise<void>;
    toggleWalkingRoutes(): Promise<void>;
    resetToDefaults(): Promise<void>;
  };
  locators: {
    walkingRoutes: Locator;
    buttons: {
      apply: Locator;
      close: Locator;
      preset(preset: Preset): Locator;
      reset: Locator;
    };
    cacheType(type: string): Locator;
    ignoredCaches: Locator;
    field(name: SettingField): Locator;
  };
}

/** The trail settings dialog, opened from the header. */
export function initSettings(page: Page): Settings {
  const root = page.getByTestId('settings-dialog');
  const locators = {
    buttons: {
      apply: root.getByTestId('settings-apply'),
      close: root.getByTestId('dialog-close'),
      preset: (preset: Preset) => root.getByTestId(`preset-${preset}`),
      reset: root.getByTestId('settings-reset'),
    },
    cacheType: (type: string) => root.getByTestId(`cache-type-${type}`),
    ignoredCaches: root.getByTestId('ignored-cache'),
    field: (name: SettingField) => root.getByTestId(`setting-${name}`),
    walkingRoutes: root.getByTestId('walking-routes'),
  };
  const interactions = {
    apply: async () => {
      await locators.buttons.apply.click();
      await expect(root).toBeHidden();
    },
    change: async (values: Partial<Record<SettingField, string>>) => {
      for (const [name, value] of Object.entries(values)) {
        await locators.field(name as SettingField).fill(value);
      }
    },
    choosePreset: async (preset: Preset) => {
      await locators.buttons.preset(preset).click();
      await expect(locators.buttons.preset(preset)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    },
    dismissWithEscape: async () => {
      await page.keyboard.press('Escape');
      await expect(root).toBeHidden();
    },
    close: async () => {
      await locators.buttons.close.click();
      await expect(root).toBeHidden();
    },
    forgetLocallyFound: async () => {
      const button = root.getByTestId('reset-locally-found');
      await button.click();
      await expect(button).toBeDisabled();
    },
    unignore: async (code: string) => {
      const row = locators.ignoredCaches.filter({ hasText: code });
      await row.getByTestId('unignore').click();
      await expect(row).toHaveCount(0);
    },
    open: async () => {
      await page.getByTestId('open-settings').click();
      await expect(root).toBeVisible();
    },
    toggleCacheType: async (type: string) => {
      await locators.cacheType(type).click();
    },
    toggleWalkingRoutes: async () => {
      const checked = await locators.walkingRoutes.isChecked();
      await locators.walkingRoutes.click();
      await expect(locators.walkingRoutes).toBeChecked({ checked: !checked });
    },
    resetToDefaults: async () => {
      await locators.buttons.reset.click();
    },
  };
  return Object.assign(() => root, { locators, do: interactions });
}
