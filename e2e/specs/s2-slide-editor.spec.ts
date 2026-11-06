import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { login } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

// Not UAT101-3-2, so the module search count in E2E-TC4 does not depend on spec order.
const MODULE_CODE = 'UAT103-3-2';

test('E2E-TC1 S2: create a three-slide note, save a draft, publish with a module and two hashtags', async ({
  page,
}) => {
  await login(page, 'student1');
  const title = `E2E note ${Date.now()}`;

  await timed('S2', async () => {
    await page.goto('/notes/new');
    await page.getByPlaceholder('Untitled note').fill(title);
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Add slide' }).click();
      await expect(page.getByRole('list', { name: 'Slides' }).getByRole('listitem')).toHaveCount(i + 2);
    }
    // Publishing drops blank slides, so each of the three gets a heading from the Text panel (the default panel).
    for (const n of [1, 2, 3]) {
      await page.getByRole('button', { name: `Slide ${n}`, exact: true }).click();
      await page.getByRole('button', { name: 'Add a heading' }).click();
    }
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Editor panels' }).getByRole('button', { name: 'Details' }).click();
    const moduleOption = await page.locator('#module option').filter({ hasText: MODULE_CODE }).textContent();
    await page.getByLabel('Module', { exact: true }).selectOption({ label: moduleOption ?? '' });
    for (const tag of ['e2e', 'slides']) {
      await page.getByLabel(/^Hashtags/).fill(tag);
      await page.getByLabel(/^Hashtags/).press('Enter');
    }
    await page.getByRole('button', { name: 'Publish' }).click();
    const dialog = page.getByRole('dialog', { name: 'Who can see this note?' });
    await dialog.getByText('Public', { exact: true }).click(); // the radio itself is visually hidden
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(/\/notes\/\d+$/);
  });

  await shoot(page, 'S2', 'published-note');
  await checkAxe(page, 'S2-published-note');
});

test('E2E-TC2 S2: the editor page has no serious axe violations', async ({ page }) => {
  await login(page, 'student1');
  await page.goto('/notes/new');
  await expect(page.getByRole('list', { name: 'Slides' })).toBeVisible();
  await shoot(page, 'S2', 'editor');
  await checkAxe(page, 'S2-editor');
});
