import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { BASELINE_FILE } from './outputs';

/** Runs the steps of one UAT task and records the elapsed seconds (the expert baseline, #81). */
export async function timed(task: string, steps: () => Promise<void>) {
  const start = performance.now();
  await steps();
  const seconds = Math.round(performance.now() - start) / 1000;
  let seconds_by_task: Record<string, number> = {};
  try {
    seconds_by_task = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).seconds;
  } catch {
    // first run: no file yet
  }
  seconds_by_task[task] = seconds;
  const cpu = os.cpus();
  const file = {
    method:
      'Wall-clock time of the task steps only (login and page set-up excluded), measured with performance.now() inside ' +
      'the Playwright specs: headless Chromium, 1 worker, Vite dev server, local Postgres 17 in Docker, database reseeded ' +
      'before the run. Each task keeps the value from its most recent run; scripted steps, so this is a floor for a human.',
    machine: `${os.type()} ${os.release()}, ${cpu[0]?.model.trim()} x${cpu.length}, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM, Node ${process.version}`,
    measured: new Date().toISOString(),
    seconds: seconds_by_task,
  };
  mkdirSync(join(BASELINE_FILE, '..'), { recursive: true });
  writeFileSync(BASELINE_FILE, JSON.stringify(file, null, 2) + '\n');
}
