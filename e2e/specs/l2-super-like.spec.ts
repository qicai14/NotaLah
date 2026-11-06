import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { login } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

test('E2E-TC5 L2: a lecturer Super Likes a student note with a remark', async ({ page }) => {
  await login(page, 'lecturer');
  await page.goto('/search');
  await page
    .getByLabel(/search/i)
    .first()
    .fill('#uat');
  // A student's note (Daniel Tan), so the lecturer sees the Super Like button.
  await page
    .getByRole('link', { name: /^UAT: TCP versus UDP/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/notes\/\d+/);

  await timed('L2', async () => {
    await page.getByRole('button', { name: /super like/i }).click();
    const dialog = page.getByRole('dialog', { name: /super like this note/i });
    await dialog.getByLabel('Review remark (optional)').fill('Clear and accurate.');
    await dialog.getByRole('button', { name: /^super like/i }).click();
    await expect(page.getByText(/verified by/i)).toBeVisible();
  });

  await shoot(page, 'L2', 'verified-note');
  await checkAxe(page, 'L2-verified-note');
});
