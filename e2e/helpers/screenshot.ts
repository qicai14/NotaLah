import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

const DIR = join(import.meta.dirname, '../../docs/screenshots/81');
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
] as const;

/** Saves <task>-<page>-<1440|375>.png, then restores the original viewport. */
export async function shoot(page: Page, task: string, name: string) {
  mkdirSync(DIR, { recursive: true });
  const original = page.viewportSize();
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.screenshot({ path: join(DIR, `${task}-${name}-${vp.width}.png`), fullPage: true });
  }
  if (original) await page.setViewportSize(original);
}
