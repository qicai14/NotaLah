import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { login } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

// Runs last (file name): suspending Daniel Tan (student1) would lock him out of the other specs.
// The seed has three reports on two notes; the queue lists one row per note.
test('E2E-TC6 A2: resolve the two reported notes (dismiss one, hide one) and suspend the author', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/reports');
  const reviews = page.getByRole('button', { name: /^Review /i });
  await expect(reviews).toHaveCount(2);
  await shoot(page, 'A2', 'reports-queue');
  await checkAxe(page, 'A2-reports-queue');

  const resolve = async (note: string, action: 'Dismiss' | 'Hide note', remark: string) => {
    await page.getByRole('button', { name: `Review ${note}` }).click();
    await page.getByLabel('Resolution remark (required)').fill(remark);
    await page.getByRole('button', { name: action, exact: true }).click();
  };

  await timed('A2', async () => {
    await resolve('UAT: Subnetting made simple', 'Dismiss', 'No breach found.');
    await expect(reviews).toHaveCount(1);
    await resolve('UAT: Copied exam answers (hidden)', 'Hide note', 'Copied content.');
    await expect(page.getByText('No open reports').first()).toBeVisible();

    // Suspend the author of the hidden note from the user list.
    await page.goto('/admin/users');
    await page.getByLabel('Search by name or email').fill('Daniel Tan');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('button', { name: 'Suspend Daniel Tan' }).click();
    await page.getByLabel('Reason to suspend Daniel Tan').fill('Plagiarism upheld.');
    await page.getByRole('button', { name: 'Confirm suspend' }).click();
    await expect(page.getByText('Daniel Tan: suspend done (status suspended).')).toBeVisible();
  });

  await shoot(page, 'A2', 'users');
  await checkAxe(page, 'A2-users');
});
