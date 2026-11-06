import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(import.meta.dirname, '../../docs/testing/e2e-baseline.json');

/** Runs the steps of one UAT task and records the elapsed seconds (the expert baseline, #81). */
export async function timed(task: string, steps: () => Promise<void>) {
  const start = Date.now();
  await steps();
  const seconds = (Date.now() - start) / 1000;
  let all: Record<string, number> = {};
  try {
    all = JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    // first run: no file yet
  }
  all[task] = seconds;
  mkdirSync(join(FILE, '..'), { recursive: true });
  writeFileSync(FILE, JSON.stringify(all, null, 2) + '\n');
}
