/**
 * Visual-verification shots for the iteration report: the OPEN wheel
 * (default + fx) and the OPEN hand album on the final build.
 * Run: node scripts/perf/shot-verify.mjs <playerId> [baseUrl]
 */
import {chromium} from '@playwright/test';
import fs from 'fs';

const playerId = process.argv[2] ?? 'p-player1-id-perflong';
const base = process.argv[3] ?? 'http://localhost:8127';
const OUT = 'screenshots/longgame-perf/visual-verify';
fs.mkdirSync(OUT, {recursive: true});

async function pump(page, times, gap) {
  for (let i = 0; i < times; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(gap);
  }
}

const browser = await chromium.launch();
for (const mode of ['default', 'fx']) {
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
  if (mode === 'fx') {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tm_console_fx_lite', '1');
      } catch { /* ok */ }
    });
  }
  await page.goto(`${base}/player?id=${playerId}&console=1&consoleProfile=tv`);
  await page.waitForSelector('.con-root', {timeout: 60_000});
  // The boot loader (.con-load) owns the screen and advances on FRAMES —
  // headless needs pumped BeginFrames to let it finish.
  // The warm-up loader mounts a beat AFTER bootstrap — give it time to
  // APPEAR first, then pump frames until it leaves (headless warm-up only
  // advances on BeginFrames).
  await pump(page, 12, 150);
  let waited = 0;
  while (waited < 300 && await page.locator('.con-load').count() > 0) {
    await pump(page, 1, 120);
    waited++;
  }
  console.log(`[${mode}] loader cleared after ${waited} pumps`);
  await pump(page, 3, 200);
  await page.waitForTimeout(1200);
  await pump(page, 2, 150);

  await page.keyboard.press('Period');
  await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
  await pump(page, 3, 120);
  await page.screenshot({path: `${OUT}/wheel-${mode}.png`});
  await page.keyboard.press('Escape');
  await pump(page, 3, 120);

  await page.locator('.con-handdock').click({timeout: 5000}).catch(() => {});
  await pump(page, 4, 150);
  if (await page.locator('.con-hand').count() > 0) {
    await page.screenshot({path: `${OUT}/hand-${mode}.png`});
  }
  await page.close();
}
await browser.close();
console.log('shots written to', OUT);
