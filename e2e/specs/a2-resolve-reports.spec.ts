import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { login } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

// Needs three open note reports (see e2e/NEEDS.md).
test('E2E-TC6 A2: resolve three reports (dismiss, hide, hide and suspend)', async ({ page }) => {
  await login(page, 'admin');
  await page.goto('/admin/reports');
  const reviews = page.getByRole('button', { name: /^Review /i });
  await expect(reviews).toHaveCount(3);
  await shoot(page, 'A2', 'reports-queue');
  await checkAxe(page, 'A2-reports-queue');

  const resolve = async (action: 'Dismiss' | 'Hide note', remark: string) => {
    await reviews.first().click();
    await page.getByLabel('Resolution remark (required)').fill(remark);
    await page.getByRole('button', { name: action, exact: true }).click();
  };

  await timed('A2', async () => {
    await resolve('Dismiss', 'No breach found.');
    await expect(reviews).toHaveCount(2);
    await resolve('Hide note', 'Copied content.');
    await expect(reviews).toHaveCount(1);
    await resolve('Hide note', 'Repeat plagiarism.');
    await expect(page.getByText('No open reports')).toBeVisible();

    // Suspend the author of the last hidden note from the user list.
    await page.goto('/admin/users');
    await page
      .getByLabel(/search/i)
      .first()
      .fill('Daniel Tan');
    await page.getByRole('button', { name: 'Suspend' }).first().click();
    await page.getByLabel(/reason|remark/i).fill('Plagiarism upheld twice.');
    await page
      .getByRole('button', { name: /suspend/i })
      .last()
      .click();
    await expect(page.getByText(/suspended/i).first()).toBeVisible();
  });

  await shoot(page, 'A2', 'users');
  await checkAxe(page, 'A2-users');
});
