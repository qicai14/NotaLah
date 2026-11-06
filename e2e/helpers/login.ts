import { expect, type Browser, type Page } from '@playwright/test';
import { ACCOUNTS, PASSWORD } from './accounts';

export async function login(page: Page, who: keyof typeof ACCOUNTS) {
  await page.goto('/login');
  await page.getByLabel('APU email').fill(ACCOUNTS[who]);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/(login|welcome)/);
}

/** A fresh browser context per user, so two people can be signed in at once. */
export async function loginAs(browser: Browser, who: keyof typeof ACCOUNTS) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, who);
  return { context, page };
}
