import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Every entry needs a reason; an unlogged serious or critical violation fails the test.
export const ALLOWLIST: { rule: string; page: string; reason: string }[] = [];

export async function checkAxe(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter(
    (v) =>
      (v.impact === 'serious' || v.impact === 'critical') &&
      !ALLOWLIST.some((a) => a.rule === v.id && a.page === name && a.reason.trim()),
  );
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
    `axe on ${name}`,
  ).toEqual([]);
}
