import { expect, test } from '@playwright/test';
import { checkAxe } from '../helpers/axe';
import { loginAs } from '../helpers/login';
import { shoot } from '../helpers/screenshot';
import { timed } from '../helpers/timing';

// Two browser contexts: student2 sends a request, student3 receives it live over Socket.io and accepts.
test('E2E-TC7 S5: message a non-friend, then accept the request', async ({ browser }) => {
  const sender = await loginAs(browser, 'student2');
  const receiver = await loginAs(browser, 'student3');
  await receiver.page.goto('/messages');
  await receiver.page
    .getByRole('navigation', { name: 'Inbox' })
    .getByRole('link', { name: /^Requests/ })
    .click();
  const text = `Hi from E2E ${Date.now()}`;

  await timed('S5', async () => {
    await sender.page.goto('/search');
    await sender.page
      .getByLabel(/search/i)
      .first()
      .fill('Wei Jie Lim');
    await sender.page
      .getByRole('link', { name: /Wei Jie Lim/ })
      .first()
      .click();
    await sender.page.getByRole('main').getByRole('link', { name: 'Message', exact: true }).click();
    await sender.page.getByPlaceholder('Write your request').fill(text);
    await sender.page.getByRole('button', { name: 'Send message' }).click();
    await expect(sender.page.getByText('Request sent')).toBeVisible();

    // No reload on the receiver: the request must arrive over the socket.
    await expect(receiver.page.getByText(text)).toBeVisible();
    await receiver.page.getByRole('button', { name: 'Accept' }).click();
    await expect(receiver.page.getByRole('list', { name: /Messages with/ })).toContainText(text);
  });

  await shoot(receiver.page, 'S5', 'chat');
  await checkAxe(receiver.page, 'S5-chat');
  await sender.context.close();
  await receiver.context.close();
});
