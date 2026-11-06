import { expect, test } from '@playwright/test';
import { login } from '../helpers/login';
import { timed } from '../helpers/timing';

// Runs against the AI stub (e2e/stub-ai), started by playwright.config webServer: no key, no network.
test('E2E-TC8 S2 assisted: paste text and tidy it into slides', async ({ page }) => {
  await login(page, 'student1');
  await page.goto('/notes/new');
  const slides = page.getByRole('list', { name: 'Slides' }).getByRole('listitem');
  await expect(slides).toHaveCount(1);

  await timed('S2-assisted', async () => {
    await page.getByRole('navigation', { name: 'Editor panels' }).getByRole('button', { name: 'Text' }).click();
    await page.getByRole('button', { name: 'Draft slides from text' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Text to turn into slides').fill('Normalisation removes redundancy. Use 1NF, 2NF and 3NF.');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog).toBeHidden();
    await expect(slides).toHaveCount(4); // the stub's three slides land after the blank one
  });
});
