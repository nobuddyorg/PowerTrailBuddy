import { expect, test } from '../fixture';

import { pocketQueryZip } from '../pocketQuery';

// Phone-sized in every project, desktop engines included: the sheet exists only below the wide layout.
test.use({ locale: 'en-GB', viewport: { width: 400, height: 800 } });

test.beforeEach(async ({ on, page }) => {
  const app = on(page);
  await app.home.do.open();
  await app.emptyState.do.importFiles([await pocketQueryZip()]);
  await app.home.do.dismissImportSummary();
});

test.describe('the panel over the map on a phone', () => {
  test('opens at half height and grows when its handle is tapped', async ({
    on,
    page,
  }) => {
    const sheet = on(page).bottomSheet;
    await expect(sheet()).toHaveAttribute('data-snap', 'half');

    await sheet.do.tapHandle();

    await expect(sheet()).toHaveAttribute('data-snap', 'full');
  });

  test('moves between heights from the keyboard', async ({ on, page }) => {
    const sheet = on(page).bottomSheet;

    await sheet.do.pressOnHandle('ArrowDown');
    await expect(sheet()).toHaveAttribute('data-snap', 'peek');
    await sheet.do.pressOnHandle('End');
    await expect(sheet()).toHaveAttribute('data-snap', 'full');
  });

  test('follows a drag of its handle', async ({ on, page }) => {
    const sheet = on(page).bottomSheet;

    await sheet.do.dragHandle(300);

    await expect(sheet()).toHaveAttribute('data-snap', 'full');
  });
});
