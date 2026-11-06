import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Every entry needs a reason; an unlogged serious or critical violation fails the test.
export const ALLOWLIST: { rule: string; page: string; reason: string }[] = [
  // Product bug, reported in the #81 handback: the author avatar link has aria-label "<Name>'s profile" but its visible text
  // is the initials (WCAG 2.5.3 Label in Name). Remove when fixed; tracked in the PR #81 follow-ups.
  {
    rule: 'label-content-name-mismatch',
    page: 'S3-feed',
    reason: 'avatar link label omits visible initials (product bug)',
  },
  {
    rule: 'label-content-name-mismatch',
    page: 'S2-published-note',
    reason: 'avatar link label omits visible initials (product bug)',
  },
  {
    rule: 'label-content-name-mismatch',
    page: 'L2-verified-note',
    reason: 'avatar link label omits visible initials (product bug)',
  },
  // Product bug, same rule: the sidebar link is labelled "Notifications, 1 unread" while its visible text differs.
  // Remove when fixed; tracked in the PR #81 follow-ups.
  {
    rule: 'label-content-name-mismatch',
    page: 'S5-chat',
    reason: 'sidebar Notifications link label differs from visible text (product bug)',
  },
];

export async function checkAxe(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter(
    (v) =>
      (v.impact === 'serious' || v.impact === 'critical') &&
      !ALLOWLIST.some((a) => a.rule === v.id && a.page === name && a.reason.trim()),
  );
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), first: ${v.nodes[0].html.slice(0, 120)}`),
    `axe on ${name}`,
  ).toEqual([]);
}
