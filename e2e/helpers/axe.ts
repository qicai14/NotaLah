import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// An entry skips a violation only when every node it reports matches `html`; any other node still fails the test.
// Each needs a `reason`. Empty since #144 was fixed.
export const ALLOWLIST: { rule: string; page: string; html: RegExp; reason: string }[] = [];

export async function checkAxe(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter(
    (v) =>
      (v.impact === 'serious' || v.impact === 'critical') &&
      !ALLOWLIST.some(
        (a) => a.rule === v.id && a.page === name && a.reason.trim() && v.nodes.every((n) => a.html.test(n.html)),
      ),
  );
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), first: ${v.nodes[0].html.slice(0, 120)}`),
    `axe on ${name}`,
  ).toEqual([]);
}
