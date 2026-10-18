import { expect, type Locator, type Page } from '@playwright/test';

interface BottomSheet {
  (): Locator;
  do: {
    dragHandle(upPixels: number): Promise<void>;
    pressOnHandle(key: string): Promise<void>;
    tapHandle(): Promise<void>;
  };
  locators: {
    handle: Locator;
  };
}

/** The panel over the map on a phone; its snap point is the `data-snap` attribute. */
export function initBottomSheet(page: Page): BottomSheet {
  const root = page.getByTestId('bottom-sheet');
  const locators = {
    handle: root.getByTestId('sheet-handle'),
  };
  const snapChange = async (act: () => Promise<void>) => {
    const before = await root.getAttribute('data-snap');
    await act();
    await expect(root).not.toHaveAttribute('data-snap', before!);
  };
  const interactions = {
    // A mouse drag stands in for a finger: the handle listens to pointer events, which both send.
    dragHandle: (upPixels: number) =>
      snapChange(async () => {
        const box = (await locators.handle.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y - upPixels, { steps: 8 });
        await page.mouse.up();
      }),
    pressOnHandle: (key: string) =>
      snapChange(async () => {
        await locators.handle.focus();
        await page.keyboard.press(key);
      }),
    tapHandle: () => snapChange(() => locators.handle.click()),
  };
  return Object.assign(() => root, { locators, do: interactions });
}
