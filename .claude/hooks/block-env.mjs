// PreToolUse hook: stops any agent from reading or printing .env files (they hold real keys).
// Allowed on .env: `grep -c/-q/-l` (key exists?), `sed -i` (edit one line), `cp`, `ls`, `test -f`.
// Exit 2 blocks the call and shows stderr to the agent.
import { readFileSync } from 'node:fs';

const ENV = String.raw`\.env(?!\.example)(?![\w.-])`;
const BASH_RULES = [
  [new RegExp(String.raw`(^|[\s;&|(])(source|\.)\s+[^\s;&|]*${ENV}`), 'sourcing .env'],
  [
    new RegExp(
      String.raw`\b(cat|type|less|more|head|tail|bat|nl|strings|xxd|od|awk|cut|sort|uniq|tac|diff|Get-Content|gc|python3?|node|perl|ruby)\b[^;&|]*${ENV}`,
    ),
    'reading .env',
  ],
  [
    new RegExp(String.raw`\b(grep|rg|findstr|Select-String)\b(?![^;&|]*\s-[a-zA-Z]*[cql]\b)[^;&|]*${ENV}`),
    'grep on .env without -c/-q/-l',
  ],
  [new RegExp(String.raw`\bsed\b(?![^;&|]*\s-i)[^;&|]*${ENV}`), 'sed on .env without -i'],
  [new RegExp(String.raw`<\s*[^\s;&|]*${ENV}`), 'redirecting .env into a command'],
  [/\b(dotenv|env-cmd)\b/, 'loading .env into the shell'],
];
const isEnvFile = (p) => /(^|[\\/])\.env(\.[\w-]+)?$/.test(p ?? '') && !p.endsWith('.env.example');

export function check(tool, input) {
  if (tool === 'Bash') {
    const hit = BASH_RULES.find(([re]) => re.test(input.command ?? ''));
    return (
      hit &&
      `Blocked: ${hit[1]}. Never source, print or read .env. Check a key with grep -c '^KEY=' .env; edit one line with sed -i.`
    );
  }
  if (['Read', 'Edit', 'Write', 'NotebookEdit'].includes(tool) && isEnvFile(input.file_path)) {
    return 'Blocked: .env files hold real keys. Use grep -c to check a key, sed -i to change one line.';
  }
  if (tool === 'Grep' && (isEnvFile(input.path) || /\.env\b/.test(input.glob ?? ''))) {
    return 'Blocked: do not search inside .env files.';
  }
}

if (process.argv[1]?.endsWith('block-env.mjs') && !process.argv.includes('--test')) {
  const { tool_name, tool_input } = JSON.parse(readFileSync(0, 'utf8'));
  const msg = check(tool_name, tool_input ?? {});
  if (msg) {
    process.stderr.write(msg);
    process.exit(2);
  }
}

if (process.argv.includes('--test')) {
  const assert = (await import('node:assert')).strict;
  const bash = (command) => check('Bash', { command });
  for (const c of [
    'source .env',
    'set -a; . ./.env; set +a',
    'cat server/.env',
    'grep KEY .env',
    'sed -n 1p .env',
    'while read l; do :; done < .env',
    'node -e "x" .env',
    'npx dotenv -- node x',
    'type .env',
  ])
    assert.ok(bash(c), `should block: ${c}`);
  for (const c of [
    "grep -c '^R2_BUCKET=' .env",
    'sed -i "s#^PORT=.*#PORT=4101#" .env',
    'cp FYP_Project/.env worktrees/a/.env',
    'cat .env.example',
    'ls -la',
    'vp run dev',
    'git status',
    'grep -q "^X=" worktrees/r8ui/.env',
  ])
    assert.ok(!bash(c), `should allow: ${c}`);
  assert.ok(check('Read', { file_path: 'C:\\x\\FYP_Project\\.env' }));
  assert.ok(check('Read', { file_path: '/x/.env.local' }));
  assert.ok(!check('Read', { file_path: '/x/.env.example' }));
  assert.ok(!check('Read', { file_path: '/x/src/env.ts' }));
  console.log('block-env self-check ok');
}
