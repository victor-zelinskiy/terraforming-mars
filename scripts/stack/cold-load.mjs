#!/usr/bin/env node
/*
 * COLD LOAD — what one boot of the client costs, measured in a real Chromium with an empty cache
 * (docs/claude/stack.md § 3 — the before / after of the bundler move).
 *
 *   node scripts/stack/cold-load.mjs [--root <dir>] [--runs 7] [--port 8190]
 *
 * <dir> is a tree that holds `build/` (the server's own build, `styles.css` and the client) and `assets/`
 * — the repository itself by default, or an `npm run e2e:snapshot` copy. The script starts THAT tree's server
 * (`node build/src/server/server.js`, a throwaway SQLite database), opens `/` in a fresh browser context per
 * run (nothing cached, no service worker) with `?perf=1`, and reads off the page:
 *
 *   html      the document's response end
 *   boot      `app:bootstrap:start` — main.js and everything it statically imports fetched, parsed and evaluated
 *   menu      the console main menu (`.cm-menu`) laid out, and the static boot curtain gone
 *   js        the bytes of every script the page fetched (transfer size — compressed where the server compresses)
 *
 * Prints the median of each. A laptop measurement: compare numbers taken on the same machine, never across machines.
 * (It launches a Playwright browser on the laptop — the owner allowed it for the stack move; it is a measurement, not
 * an e2e run.)
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const root = path.resolve(arg('root', ROOT));
const runs = Number(arg('runs', '7'));
const port = Number(arg('port', '8190'));

const db = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-cold-load-'));
const server = spawn(process.execPath, [path.join(root, 'build', 'src', 'server', 'server.js')], {
  cwd: root,
  // TM_DB_FOLDER: a THROWAWAY SQLite database (the e2e harness's own way) — never the tree's own db/.
  env: {...process.env, PORT: String(port), TM_DB_FOLDER: db, NODE_ENV: 'production'},
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => serverLog += chunk);
server.stderr.on('data', (chunk) => serverLog += chunk);

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the server did not come up:\n${serverLog}`);
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

try {
  await waitForServer();
  const browser = await chromium.launch();
  const samples = [];
  for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({serviceWorkers: 'block', viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();
    // `?perf=1` turns the User Timing marks on (`client/utils/perfMarks.ts`) — the boot mark is one of them.
    await page.goto(`http://localhost:${port}/?perf=1`);
    await page.waitForFunction(() => document.querySelector('.cm-menu') !== null && document.getElementById('boot-curtain') === null, undefined, {timeout: 60_000});
    const sample = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const boot = performance.getEntriesByName('app:bootstrap:start')[0];
      const js = performance.getEntriesByType('resource')
        .filter((entry) => /\.m?js(\?|$)/.test(entry.name))
        .reduce((sum, entry) => sum + entry.transferSize, 0);
      return {html: nav.responseEnd, boot: boot?.startTime ?? NaN, menu: performance.now(), js};
    });
    samples.push(sample);
    await context.close();
  }
  await browser.close();
  const out = {};
  for (const key of ['html', 'boot', 'menu', 'js']) {
    out[key] = Math.round(median(samples.map((sample) => sample[key])));
  }
  console.log(JSON.stringify({root: path.relative(ROOT, root) || '.', runs, ...out}));
} finally {
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await exited;
  // Best effort: Windows can hold the database file an instant past the exit.
  fs.rmSync(db, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}
