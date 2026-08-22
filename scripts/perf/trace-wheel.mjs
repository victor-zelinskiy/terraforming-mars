/**
 * TRACE ATTRIBUTION for the console wheel / hand / idle — captures real
 * Chromium traces around each interaction and prints the per-event-name
 * totals (EvaluateScript / FunctionCall = JS, UpdateLayoutTree = style
 * recalc, Layout, PrePaint/Paint/Layerize = paint pipeline) plus the top
 * spans. This is the style/layout/paint half of the probe's attribution
 * (the probe itself measures press→sync-JS→in-DOM phases).
 *
 * Run: node scripts/perf/trace-wheel.mjs <playerId> [baseUrl]
 * Env: TRACE_THROTTLE=4 — CPU-throttle the page (Deck-class attribution);
 *      TRACE_PROFILE=tv|handheld (default tv).
 */
import {chromium} from '@playwright/test';
import fs from 'fs';

const playerId = process.argv[2] ?? 'p-player1-id-perflong';
const base = process.argv[3] ?? 'http://localhost:8127';
const throttle = Number(process.env.TRACE_THROTTLE ?? '1');
const profile = process.env.TRACE_PROFILE ?? 'tv';
const OUT = 'screenshots/longgame-perf/trace';

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
         e.name === 'UpdateLayerTree' || e.name === 'PrePaint' || e.name === 'Layerize' ||
         e.name === 'RunMicrotasks' || e.name === 'TimerFire' || e.name === 'V8.GCScavenger' ||
         e.name === 'MinorGC' || e.name === 'MajorGC' || e.name === 'V8.GCFinalizeMC') &&
        (e.ph === 'X' || e.ph === 'B') && typeof e.dur === 'number') {
      spans.push({
        name: e.name,
        durMs: e.dur / 1000,
        elements: e.args?.elementCount ?? e.args?.beginData?.dirtyObjects ?? e.args?.data?.elementCount,
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
  console.log(`== ${label} — top 10 spans`);
  for (const s of spans.slice(0, 10)) {
    console.log(`  ${s.name} ${s.durMs.toFixed(1)}ms${s.elements !== undefined ? ` elements=${s.elements}` : ''}`);
  }
}

const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'];

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
fs.mkdirSync(OUT, {recursive: true});
if (throttle > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle});
}

await page.goto(`${base}/player?id=${playerId}&console=1&consoleProfile=${profile}`);
await page.waitForSelector('.con-root', {timeout: 60_000});
await pump(page, 4, 200);
await page.waitForTimeout(1500);

// ── trace 0: 3 s IDLE on the settled board (what paints at rest?) ──────────
await browser.startTracing(page, {path: `${OUT}/idle.json`, categories: CATS});
await pump(page, 1, 60);
await page.waitForTimeout(3000);
await browser.stopTracing();
summarize(`${OUT}/idle.json`, `IDLE 3s (throttle x${throttle})`);

// ── trace 1: FIRST wheel open (carries the pre-warm) ───────────────────────
await browser.startTracing(page, {path: `${OUT}/wheel-first.json`, categories: CATS});
await page.keyboard.press('Period');
await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
await pump(page, 4, 100);
await browser.stopTracing();
summarize(`${OUT}/wheel-first.json`, 'WHEEL FIRST OPEN');

// close + settle
await page.keyboard.press('Escape');
await pump(page, 3, 120);
await page.waitForTimeout(400);

// warm-up two more cycles untraced
for (let i = 0; i < 2; i++) {
  await page.keyboard.press('Period');
  await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
  await pump(page, 2, 100);
  await page.keyboard.press('Escape');
  await pump(page, 2, 120);
  await page.waitForTimeout(300);
}

// ── trace 2: WARM wheel open ───────────────────────────────────────────────
await browser.startTracing(page, {path: `${OUT}/wheel-warm.json`, categories: CATS});
await page.keyboard.press('Period');
await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
await pump(page, 4, 100);
await browser.stopTracing();
summarize(`${OUT}/wheel-warm.json`, 'WHEEL WARM OPEN');

// ── trace 3: wheel CLOSE ───────────────────────────────────────────────────
await browser.startTracing(page, {path: `${OUT}/wheel-close.json`, categories: CATS});
await page.keyboard.press('Escape');
await pump(page, 4, 100);
await page.waitForTimeout(300);
await browser.stopTracing();
summarize(`${OUT}/wheel-close.json`, 'WHEEL CLOSE');

// ── trace 4: HAND open (workspace + dock lift + album) ─────────────────────
await browser.startTracing(page, {path: `${OUT}/hand-open.json`, categories: CATS});
await page.locator('.con-handdock').click({timeout: 3000}).catch(() => {});
await page.locator('.con-hand').waitFor({state: 'visible', timeout: 20_000}).catch(() => {});
await pump(page, 4, 120);
await browser.stopTracing();
summarize(`${OUT}/hand-open.json`, 'HAND OPEN');
await page.keyboard.press('Escape');
await pump(page, 3, 120);

await browser.close();
