/**
 * WHO CHURNS THE DOM during the category flight? Arms a global
 * MutationObserver over the episode and histograms mutation targets —
 * the definitive name of the per-frame invalidation driver.
 *
 * Run: node scripts/perf/find-mutator.mjs <playerId> [baseUrl]
 */
import {chromium} from '@playwright/test';

const playerId = process.argv[2] ?? 'p-player1-id-perf100';
const base = process.argv[3] ?? 'http://localhost:8123';

async function pump(page, times, gap) {
  for (let i = 0; i < times; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(gap);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
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

await page.evaluate(() => {
  const w = window;
  const rec = {byTarget: {}, samples: []};
  w.__mutRec = rec;
  const label = (el) => {
    if (!(el instanceof Element)) {
      return el.nodeName ?? '?';
    }
    const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 3).join('.') : '';
    return `${el.tagName}.${cls}`;
  };
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      const key = `${m.type}:${m.attributeName ?? ''} @ ${label(m.target)}`;
      rec.byTarget[key] = (rec.byTarget[key] ?? 0) + 1;
      if (m.type === 'childList' && rec.samples.length < 40 && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        rec.samples.push(`${label(m.target)} +${m.addedNodes.length} -${m.removedNodes.length} added0=${m.addedNodes[0] ? label(m.addedNodes[0]) : ''}`);
      }
    }
  });
  mo.observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeOldValue: false});
  w.__mutStop = () => mo.disconnect();
});

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

const rec = await page.evaluate(() => {
  window.__mutStop?.();
  return window.__mutRec;
});
const entries = Object.entries(rec.byTarget).sort((a, b) => b[1] - a[1]);
console.log('top mutation targets:');
for (const [k, n] of entries.slice(0, 30)) {
  console.log(`  ${String(n).padStart(6)} × ${k}`);
}
console.log('\nchildList samples:');
for (const s of rec.samples) {
  console.log('  ', s);
}
await browser.close();
