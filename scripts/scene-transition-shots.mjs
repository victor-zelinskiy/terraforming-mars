/*
 * Dev-only visual evidence for the scene-transition rework: captures the
 * transition surface mid-covering (slow-load composition with the status
 * block) and the revealed destination, at FHD and 4K-TV.
 *
 *   node scripts/scene-transition-shots.mjs <playerId>
 *
 * Expects the app server on :8080 (npm start).
 */
import {chromium} from '@playwright/test';
import {mkdirSync} from 'node:fs';

const playerId = process.argv[2];
if (playerId === undefined) {
  console.error('usage: node scripts/scene-transition-shots.mjs <playerId>');
  process.exit(1);
}
const OUT = 'screenshots/scene-transition';
mkdirSync(OUT, {recursive: true});

const profiles = [
  {name: 'fhd', width: 1920, height: 1080, query: ''},
  // Headless has no physical-panel signal — force the profiles explicitly.
  {name: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {name: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
];

const browser = await chromium.launch();
for (const p of profiles) {
  const ctx = await browser.newContext({viewport: {width: p.width, height: p.height}});
  const page = await ctx.newPage();
  // Consume the once-per-session GPU warm-up on the menu first, so the
  // curtain shot shows the transition surface itself.
  await page.goto('http://localhost:8080/');
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});
  await page.route('**/api/player*', async (route) => {
    await new Promise((r) => setTimeout(r, 3200));
    await route.continue();
  });
  await page.goto(`http://localhost:8080/player?id=${playerId}&console=1${p.query}`);
  await page.waitForSelector('.con-load__foot--shown', {timeout: 15_000});
  await page.waitForTimeout(600); // let the foot's rise settle
  await page.screenshot({path: `${OUT}/curtain-${p.name}.png`});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});
  await page.waitForTimeout(800);
  await page.screenshot({path: `${OUT}/revealed-${p.name}.png`});
  await ctx.close();
}
await browser.close();
console.log('shots written to', OUT);
