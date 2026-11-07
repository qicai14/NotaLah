// Deterministic stand-in for the AI provider (R28): one OpenAI-compatible chat completion that returns a fixed
// three-slide outline, so the E2E run needs no key or network. Point the API at it with AI_BASE_URL=http://127.0.0.1:4010.
import { createServer } from 'node:http';

export const OUTLINE = {
  slides: [
    { layout: 'title', title: 'Stub outline', subtitle: 'Drafted by the E2E stub' },
    { layout: 'title-body', title: 'Key points', bullets: ['First point', 'Second point'] },
    { layout: 'title-body', title: 'Summary', bullets: ['Wrap up'] },
  ],
};

createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    if (req.url === '/health') {
      res.writeHead(200).end('ok'); // the Playwright webServer readiness probe
      return;
    }
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: JSON.stringify(OUTLINE) } }],
        usage: { total_tokens: 100 },
      }),
    );
  });
}).listen(4010, '127.0.0.1');
