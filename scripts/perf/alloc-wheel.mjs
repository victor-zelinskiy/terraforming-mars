/**
 * ALLOCATION SAMPLING for common console interactions — CDP
 * HeapProfiler.startSampling around (a) a 10 s idle window and (b) 6 wheel
 * open/close cycles, then prints the top allocating call sites by self size.
 * Answers «what garbage do common interactions create?» (GC-pause budget).
 *
 * Run: node scripts/perf/alloc-wheel.mjs <playerId> [baseUrl]
 */
import {chromium} from '@playwright/test';

const playerId = process.argv[2] ?? 'p-player1-id-perflong';
const base = process.argv[3] ?? 'http://localhost:8127';

async function pump(page, times, gap) {
  for (let i = 0; i < times; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(gap);
  }
}

function flatten(node, path, out) {
  const self = node.selfSize ?? 0;
  const name = node.callFrame ? `${node.callFrame.functionName || '(anon)'} @ ${(node.callFrame.url || '').split('/').pop()}:${node.callFrame.lineNumber}` : '(root)';
  if (self > 0) {
    out.push({name, self});
  }
  for (const child of node.children ?? []) {
    flatten(child, path, out);
  }
}

function summarize(profile, label) {
  const out = [];
  flatten(profile.head, '', out);
  const byName = new Map();
  let total = 0;
  for (const s of out) {
    total += s.self;
    byName.set(s.name, (byName.get(s.name) ?? 0) + s.self);
  }
  console.log(`\n== ${label}: sampled ~${(total / 1024 / 1024).toFixed(1)} MB allocated`);
  for (const [name, size] of [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)) {
    console.log(`  ${(size / 1024).toFixed(0).padStart(8)} KB  ${name}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
const cdp = await page.context().newCDPSession(page);

await page.goto(`${base}/player?id=${playerId}&console=1&consoleProfile=tv`);
await page.waitForSelector('.con-root', {timeout: 60_000});
await pump(page, 4, 200);
await page.waitForTimeout(1500);

// warm the wheel path first (cold open allocates one-time caches)
await page.keyboard.press('Period');
await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
await pump(page, 2, 100);
await page.keyboard.press('Escape');
await pump(page, 2, 120);
await page.waitForTimeout(400);

// ── (a) idle 10 s ──────────────────────────────────────────────────────────
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.startSampling', {samplingInterval: 8192});
await page.waitForTimeout(10_000);
let res = await cdp.send('HeapProfiler.stopSampling');
summarize(res.profile, 'IDLE 10 s');

// ── (b) 6 wheel cycles ─────────────────────────────────────────────────────
await cdp.send('HeapProfiler.startSampling', {samplingInterval: 8192});
for (let i = 0; i < 6; i++) {
  await page.keyboard.press('Period');
  await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
  await pump(page, 2, 100);
  await page.keyboard.press('Escape');
  await pump(page, 2, 120);
  await page.waitForTimeout(250);
}
res = await cdp.send('HeapProfiler.stopSampling');
summarize(res.profile, 'WHEEL x6 cycles');

await browser.close();
