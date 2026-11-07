import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { MODULE_CODE, SEED_HASHTAG } from '../helpers/accounts';
import { login } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

test('E2E-TC3 S3: like, comment on and save a note from the feed', async ({ page }) => {
  await login(page, 'student2');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Next note' })).toBeVisible();
  await shoot(page, 'S3', 'feed');
  await checkAxe(page, 'S3-feed');

  await timed('S3', async () => {
    const like = page.getByRole('button', { name: /^like/i }).first();
    const save = page.getByRole('button', { name: /^save/i }).first();
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await page
      .getByRole('button', { name: /comment/i })
      .first()
      .click();
    await page.getByRole('textbox', { name: /comment/i }).fill('Useful summary, thanks');
    await page.getByRole('button', { name: /^(post|send)/i }).click();
    await expect(page.getByText('Useful summary, thanks')).toBeVisible();
  });
});

test('E2E-TC4 S4: find notes by module code and by hashtag', async ({ page }) => {
  await login(page, 'student2');
  await page.goto('/search');

  await timed('S4-module', async () => {
    await page
      .getByLabel(/search/i)
      .first()
      .fill(MODULE_CODE);
    // The seed has four UAT101 notes; waiting on the count stops the previous results satisfying the check.
    await expect(page.getByRole('status').filter({ hasText: '4 results shown' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^UAT:/ })).toHaveCount(4);
  });
  await shoot(page, 'S4', 'search-module');
  await checkAxe(page, 'S4-search-module');

  await timed('S4-hashtag', async () => {
    await page
      .getByLabel(/search/i)
      .first()
      .fill(`#${SEED_HASHTAG}`);
    await expect(page.getByRole('status').filter({ hasText: '14 results shown' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^UAT:/ })).toHaveCount(14);
  });
  await shoot(page, 'S4', 'search-hashtag');
  await checkAxe(page, 'S4-search-hashtag');
});
