import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// An entry skips a violation only when every node it reports matches `html`; any other node still fails the test.
// All are one product bug (#144): an aria-label that omits the visible text (WCAG 2.5.3 Label in Name).
const AVATAR = String.raw`[^"]+'s profile`; // author avatar link: visible text is the initials
const NOTIFICATIONS = String.raw`Notifications, \d+ unread`; // sidebar link, shown on any page once a notification is unread
const SUPER_LIKE = 'Remove Super Like'; // toggle on a verified note
const labels = (...alts: string[]) => new RegExp(`aria-label="(?:${alts.join('|')})"`);
const pages: Record<string, RegExp> = {
  'S3-feed': labels(AVATAR, NOTIFICATIONS),
  'S2-published-note': labels(AVATAR, NOTIFICATIONS),
  'L2-verified-note': labels(AVATAR, NOTIFICATIONS, SUPER_LIKE),
  'S5-chat': labels(NOTIFICATIONS),
};
export const ALLOWLIST: { rule: string; page: string; html: RegExp; reason: string }[] = Object.entries(pages).map(
  ([page, html]) => ({
    rule: 'label-content-name-mismatch',
    page,
    html,
    reason: 'aria-label omits the visible text (product bug, #144)',
  }),
);

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
