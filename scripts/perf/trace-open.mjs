/**
 * ONE-OFF TRACE of the «Разыграно» open — attribution for the style-recalc
 * cost the probe surfaced (RecalcStyle ≈ 90% of the open/category task time).
 * Captures a real Chromium trace around X-open and category-open, then prints
 * the heaviest UpdateLayoutTree / Layout events with their element counts.
 *
 * Run: node scripts/perf/trace-open.mjs <playerId> [baseUrl]
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

function summarize(traceFile, label) {
  const data = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  const events = data.traceEvents ?? data;
  const spans = [];
  for (const e of events) {
    if ((e.name === 'UpdateLayoutTree' || e.name === 'Layout' || e.name === 'FunctionCall' ||
         e.name === 'EvaluateScript' || e.name === 'HitTest' || e.name === 'Paint' ||
         e.name === 'UpdateLayerTree' || e.name === 'PrePaint' || e.name === 'Layerize') &&
        (e.ph === 'X' || e.ph === 'B') && typeof e.dur === 'number') {
      spans.push({
        name: e.name,
        durMs: e.dur / 1000,
        elements: e.args?.elementCount ?? e.args?.beginData?.dirtyObjects ?? e.args?.data?.elementCount,
        extra: e.args?.beginData?.frame !== undefined ? undefined : undefined,
      });
    }
  }
  spans.sort((a, b) => b.durMs - a.durMs);
  const byName = new Map();
  for (const s of spans) {
    const cur = byName.get(s.name) ?? {count: 0, total: 0, max: 0};
    cur.count++;
    cur.total += s.durMs;
    cur.max = Math.max(cur.max, s.durMs);
    byName.set(s.name, cur);
  }
  console.log(`\n== ${label} — totals by event`);
  for (const [name, v] of [...byName.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${name}: total ${v.total.toFixed(1)}ms, count ${v.count}, max ${v.max.toFixed(1)}ms`);
  }
  console.log(`== ${label} — top 12 spans`);
  for (const s of spans.slice(0, 12)) {
    console.log(`  ${s.name} ${s.durMs.toFixed(1)}ms${s.elements !== undefined ? ` elements=${s.elements}` : ''}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
fs.mkdirSync(OUT, {recursive: true});

await page.goto(`${base}/player?id=${playerId}&console=1&consoleProfile=handheld`);
await page.waitForSelector('.con-root', {timeout: 60_000});
await pump(page, 4, 200);
await page.waitForTimeout(1200);

// ── trace 1: open by X ─────────────────────────────────────────────────────
await browser.startTracing(page, {path: `${OUT}/open.json`, categories: [
  'devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing',
]});
await page.keyboard.press('KeyX');
await page.locator('.con-played').waitFor({state: 'visible', timeout: 20_000});
await pump(page, 5, 100);
await page.waitForTimeout(400);
await browser.stopTracing();
summarize(`${OUT}/open.json`, 'OPEN BY X');

// ── trace 2: category open ─────────────────────────────────────────────────
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
await browser.startTracing(page, {path: `${OUT}/category.json`, categories: [
  'devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing',
]});
const zone = page.locator(`[data-played-cat="${biggest}"]`).first();
await zone.click();
await page.waitForTimeout(120);
await zone.click();
// Park the pointer in a corner: flying proxies crossing a resting cursor
// re-evaluate :hover chains per frame (isolate that axis from the trace).
if (process.env.TRACE_PARK_MOUSE === '1') {
  await page.mouse.move(4, 4);
}
await page.locator('.con-played-cat').waitFor({state: 'visible', timeout: 20_000});
for (let i = 0; i < 30; i++) {
  await pump(page, 1, 80);
  if (await page.locator('.con-played-cat--framed').count() > 0) {
    break;
  }
}
await pump(page, 3, 100);
await browser.stopTracing();
summarize(`${OUT}/category.json`, `CATEGORY OPEN (${biggest})`);

await browser.close();
