import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { MODULE_CODE } from '../helpers/accounts';
import { login } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

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
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/saved/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Publish' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /public/i }).check();
    await dialog.getByRole('combobox', { name: /module/i }).fill(MODULE_CODE);
    await dialog.getByRole('option', { name: new RegExp(MODULE_CODE) }).click();
    for (const tag of ['e2e', 'slides']) {
      await dialog.getByLabel(/hashtag/i).fill(tag);
      await dialog.getByLabel(/hashtag/i).press('Enter');
    }
    await dialog.getByRole('button', { name: /^publish/i }).click();
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
