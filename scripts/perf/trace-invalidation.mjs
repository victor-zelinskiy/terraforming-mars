/**
 * INVALIDATION-TRACKING TRACE of the category open — answers exactly WHAT
 * dirties the whole document per frame (the 453 × ~9400-element
 * UpdateLayoutTree storm found by trace-open.mjs).
 *
 * Run: node scripts/perf/trace-invalidation.mjs <playerId> [baseUrl]
 */
import {chromium} from '@playwright/test';
import fs from 'fs';

const playerId = process.argv[2] ?? 'p-player1-id-perf100';
const base = process.argv[3] ?? 'http://localhost:8123';
const OUT = 'screenshots/played-perf/trace';

async function pump(page, times, gap) {
  for (let i = 0; i < times; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(gap);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
fs.mkdirSync(OUT, {recursive: true});

await page.goto(`${base}/player?id=${playerId}&console=1&consoleProfile=handheld`);
await page.waitForSelector('.con-root', {timeout: 60_000});
await pump(page, 4, 200);
await page.waitForTimeout(1200);

await page.keyboard.press('KeyX');
await page.locator('.con-played').waitFor({state: 'visible', timeout: 20_000});
await pump(page, 3, 120);

const biggest = await page.evaluate(() => {
  let best = '';
  let bestN = -1;
  document.querySelectorAll('.con-played [data-played-cat]').forEach((el) => {
    const n = el.querySelectorAll('.con-played__slot').length;
    if (n > bestN) {
      bestN = n;
      best = el.dataset.playedCat ?? '';
    }
  });
  return best;
});

await browser.startTracing(page, {path: `${OUT}/category-inv.json`, categories: [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.invalidationTracking',
]});
const zone = page.locator(`[data-played-cat="${biggest}"]`).first();
await zone.click();
await page.waitForTimeout(120);
await zone.click();
await page.locator('.con-played-cat').waitFor({state: 'visible', timeout: 20_000});
for (let i = 0; i < 25; i++) {
  await pump(page, 1, 80);
  if (await page.locator('.con-played-cat--framed').count() > 0) {
    break;
  }
}
await pump(page, 3, 100);
await browser.stopTracing();
await browser.close();

// ── analysis ───────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(`${OUT}/category-inv.json`, 'utf8'));
const events = data.traceEvents ?? data;

const styleInv = new Map(); // reason|selector histogram
let styleInvCount = 0;
const bigRecalcs = [];
for (const e of events) {
  if (e.name === 'StyleRecalcInvalidationTracking' || e.name === 'ScheduleStyleInvalidationTracking' ||
      e.name === 'StyleInvalidatorInvalidationTracking') {
    styleInvCount++;
    const d = e.args?.data ?? {};
    const key = `${e.name}: ${d.reason ?? ''} ${d.invalidatedSelectorId ?? ''} ${d.extraData ?? ''} ${(d.invalidationList ?? []).map((x) => x.classes ?? x.id ?? '').join(',').slice(0, 80)} node=${d.nodeName ?? ''}`;
    styleInv.set(key, (styleInv.get(key) ?? 0) + 1);
  }
  if (e.name === 'UpdateLayoutTree' && typeof e.dur === 'number' && (e.args?.elementCount ?? 0) > 3000) {
    bigRecalcs.push({durMs: e.dur / 1000, elements: e.args.elementCount});
  }
}

console.log(`\nbig recalcs (>3000 elements): ${bigRecalcs.length}, total ${bigRecalcs.reduce((s, r) => s + r.durMs, 0).toFixed(0)}ms`);
console.log(`invalidation events: ${styleInvCount}`);
const top = [...styleInv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
for (const [k, n] of top) {
  console.log(`  ${String(n).padStart(6)} × ${k}`);
}
