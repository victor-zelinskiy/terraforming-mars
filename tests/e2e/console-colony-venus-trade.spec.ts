import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, cinematicBeat, press, pressUntil, settle} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * THE REDUX VENUS TRADE — one trade, three things at once, in ORDER
 * (the 2026-09-28 report, fixture `venus-trade`):
 *
 *   · a CARD-TARGET reward (1 floater, two holders → a real pick, chosen
 *     BEFORE the confirm) — the target is never asked again: the owner
 *     bonus's mandatory DISCARD stands in front of the reward pick, and the
 *     batch's answer PARKS past it (`deferredInputBatch.hiddenInfoPrompt`);
 *   · the reward LANDS on a standing card — the chip touches down while the
 *     presented card is on stage and NOT leaving, and the owner bonus's cards
 *     (the covers flying into the reveal) rise only AFTER that card scene has
 *     left (`ConsoleColonyTradeLayer.waitForCause` + the `colony-card-scene`
 *     hold);
 *   · the FIXED Venus step crosses 8 % — the board's bonus draw is a
 *     `globalParameter` batch queued IN FRONT of the colony's own. It presents
 *     NOWHERE while the workspace stands (the queue skips a parked batch —
 *     `registerRevealQueuePark`), the HUD holds 6 %, and after the flow leaves
 *     the scales tell the 8 % story and the card lifts off the marker.
 *
 * Evidence → screenshots/venus-trade/.
 */

const OUT = path.resolve('screenshots', 'venus-trade');
const VENUS = 'Venus Redux';
const TARGET = 'Dirigibles';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function venusStrip(page: Page): Promise<string> {
  return page.evaluate(() =>
    (document.querySelector('.con-status__param--venus .con-status__value')?.textContent ?? '').trim());
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

async function focusedRowText(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('.con-colfocus__steprow--focused')?.textContent ?? '').toUpperCase());
}

async function focusTargetRow(page: Page): Promise<void> {
  for (let i = 0; i < 10 && !(await focusedRowText(page)).includes('ЦЕЛЬ'); i++) {
    await press(page, 'ArrowDown', 350);
  }
  expect(await focusedRowText(page), 'the target decision row must take focus').toContain('ЦЕЛЬ');
}

async function targetRowText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.con-colfocus__steprow'));
    const target = rows.find((r) => (r.textContent ?? '').toUpperCase().includes('ЦЕЛЬ'));
    return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

const focusedCandidate = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector('.con-ptsel__slot--focused .pcard')?.closest('[data-ptsel-cell]')?.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');

type Sample = {
  t: number,
  colonies: boolean,
  cardland: boolean,
  leaving: boolean,
  landed: boolean,
  chip: boolean,
  covers: number,
  revealInside: boolean,
  revealForeign: boolean,
  zoom: boolean,
  strip: string,
  stranded: boolean,
  picker: boolean,
  handStep: boolean,
  landings: string,
};
type Probe = {samples: Array<Sample>, ticks: number};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__venusTrade: Probe};
    w.__venusTrade = {samples: [], ticks: 0};
    const t0 = performance.now();
    const sample = () => {
      const crumb = Array.from(document.querySelectorAll('.con-wshead')).map((h) => (h.textContent ?? '').toUpperCase()).join(' ');
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        colonies: document.querySelector('.con-colonies') !== null,
        cardland: document.querySelector('.con-colfocus__cardland') !== null,
        leaving: document.querySelector('.con-colfocus__cardland--leaving') !== null,
        landed: document.querySelector('.con-colfocus__landcell--landed') !== null,
        chip: document.querySelector('.con-transfer__chip') !== null,
        covers: document.querySelectorAll('.con-coltrade-proxy, .con-bonusfly-proxy').length,
        revealInside: document.querySelector('.con-colonies .con-reveal') !== null,
        revealForeign: document.querySelector('.con-reveal') !== null && document.querySelector('.con-colonies .con-reveal') === null,
        zoom: document.querySelector('.card-zoom-dialog') !== null,
        strip: (document.querySelector('.con-status__param--venus .con-status__value')?.textContent ?? '').trim(),
        stranded: document.querySelector('.con-stranded') !== null,
        picker: crumb.includes('ЦЕЛЬ НА КАРТЕ') ||
          Array.from(document.querySelectorAll('.con-ptsel')).some((el) => el.closest('.con-colfocus__targetstage') === null),
        handStep: document.querySelector('.con-colonies .con-hand--embedded') !== null,
        landings: JSON.stringify((window as unknown as {__conColonyDiag?: () => {trade: {landings: unknown}}}).__conColonyDiag?.()?.trade.landings ?? {}),
      };
      w.__venusTrade.ticks++;
      const last = w.__venusTrade.samples[w.__venusTrade.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0}) !== JSON.stringify({...s, t: 0})) {
        w.__venusTrade.samples.push(s);
      }
      if (w.__venusTrade.samples.length > 6000) {
        w.__venusTrade.samples.splice(0, 1000);
      }
    };
    sample();
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    window.setInterval(sample, 40);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__venusTrade: Probe}).__venusTrade);

test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

test('Venus trade: the pre-selected target lands on a standing card, the owner bonus waits its turn, the 8 % card waits for the board', async ({page, request}) => {
  test.setTimeout(540_000);
  const t0 = Date.now();
  const lap = (label: string) => console.log(`[t+${Math.round((Date.now() - t0) / 1000)}s] ${label}`);
  await bootFixture(page, request, 'venus-trade', {keepColony: VENUS});
  await settle(page);
  await armLeakWitness(page);
  expect(await venusStrip(page), 'the fixture stands at 6 %').toBe('6%');
  lap('booted');

  await openColonies(page);
  await focusTile(page, VENUS);
  await press(page, 'Enter', 2000);
  expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);
  await shoot(page, '00-trade-review');

  // The target decision: descend, walk onto the named holder, choose.
  await focusTargetRow(page);
  await press(page, 'Enter', 1200);
  expect(await page.locator('.con-colfocus__targetstage').count(), 'the embedded target step stands').toBeGreaterThan(0);
  for (let i = 0; i < 4 && (await focusedCandidate(page)) !== TARGET; i++) {
    await press(page, 'ArrowRight', 450);
  }
  expect(await focusedCandidate(page), 'the cursor reached the named holder').toBe(TARGET);
  await press(page, 'Enter', 1000);
  expect(await page.locator('.con-colfocus__targetstage').count(), 'the pick returns to the review').toBe(0);
  const row = await targetRowText(page);
  console.log('target row:', row);
  expect(row, 'the row shows the chosen card with its before → after').toMatch(/\d+\s*→\s*\d+/);
  await shoot(page, '01-picked');
  lap('target picked');

  await armProbe(page);
  await press(page, 'KeyX', 300); // confirm the trade
  lap('confirmed');

  // ── The owner bonus: the drawn card presents INSIDE the workspace, A takes it, the same press opens the discard. ──
  const embeddedHand = page.locator('.con-colonies .con-hand--embedded');
  await expect(page.locator('.con-colonies .con-reveal'), 'the owner bonus card presents inside the colony workspace')
    .toBeVisible({timeout: 45_000});
  await shoot(page, '02-owner-bonus');
  for (let i = 0; i < 14 && await embeddedHand.count() === 0; i++) {
    await press(page, 'Enter', 2400);
  }
  await expect(embeddedHand, 'the mandatory discard opens EMBEDDED inside the colony workspace').toBeVisible({timeout: 12_000});
  await shoot(page, '03-discard');
  lap('discard step up');
  await press(page, 'Enter', 3200); // discard the focused card
  await cinematicBeat(page, 2400, 'the discard flight paces the mandatory chain');

  // ── The flow LEAVES; then the board's story: the scales, then the 8 % card off the marker. ──
  await expect.poll(async () => page.locator('.con-colonies').count(), {timeout: 60_000, message: 'the finished trade leaves for the board'}).toBe(0);
  lap('workspace gone');
  await shoot(page, '04-after-workspace');
  // STATE WAITS, never a duration: the 8 % card RISES over the board (the reveal or the fullscreen
  // viewer), A takes it, and the scales' story settles at 8 %.
  const cardOverBoard = () => page.evaluate(() => document.querySelector('.con-reveal, .card-zoom-dialog') !== null);
  await expect.poll(cardOverBoard, {timeout: 30_000, message: 'the 8 % card rises over the board'}).toBe(true);
  await shoot(page, '05-venus-card-over-board');
  const took = await pressUntil(page, 'Enter', async () => !(await cardOverBoard()), {tries: 6, settleMs: 600});
  await expect.poll(() => venusStrip(page), {timeout: 20_000, message: 'the scale story settles at 8 %'}).toBe('8%');
  await shoot(page, '06-settled');
  lap('story told');

  const probe = await readProbe(page);
  const samples = probe.samples;
  const lastStanding = samples.map((s) => s.cardland && !s.leaving).lastIndexOf(true);
  const firstLanded = samples.findIndex((s) => s.landed);
  const firstCovers = samples.findIndex((s) => s.covers > 0);
  const firstRevealInside = samples.findIndex((s) => s.revealInside);
  const whileColonies = samples.filter((s) => s.colonies);
  const summary = {
    samples: samples.length, ticks: probe.ticks, lastStanding, firstLanded, firstCovers, firstRevealInside,
    landedOnStanding: firstLanded >= 0 && samples[firstLanded].cardland && !samples[firstLanded].leaving,
    pickerWhileColonies: whileColonies.filter((s) => s.picker).length,
    foreignRevealWhileColonies: whileColonies.filter((s) => s.revealForeign || s.zoom).length,
    strip8WhileColonies: whileColonies.filter((s) => s.strip.includes('8')).length,
    stranded: samples.filter((s) => s.stranded).length,
    handStep: samples.some((s) => s.handStep),
    took,
    stripEnd: await venusStrip(page),
  };
  console.log('── venus trade summary ──', JSON.stringify(summary, null, 1));
  const diag = await page.evaluate(() => {
    const d = (window as unknown as {__conColonyDiag?: () => {trade: unknown, transfer: {trail: unknown}}}).__conColonyDiag?.();
    return d === undefined ? null : {trade: d.trade, trail: d.transfer.trail};
  });
  console.log('── trade diag ──', JSON.stringify(diag));
  console.log('── trace (changes only) ──\n' + samples.map((s) =>
    `${s.t} col:${+s.colonies} land:${+s.cardland}${s.leaving ? 'L' : ''} landed:${+s.landed} chip:${+s.chip} cov:${s.covers} rin:${+s.revealInside} rfo:${+s.revealForeign} z:${+s.zoom} v:${s.strip} pk:${+s.picker} hs:${+s.handStep} str:${+s.stranded} L:${s.landings}`).join('\n'));

  expect(summary.ticks, 'the probe was alive').toBeGreaterThan(30);
  // ① the pre-selected target is never asked again
  expect(summary.pickerWhileColonies, 'a card-target picker rose after the confirm').toBe(0);
  // ② the reward lands on a STANDING card, and the owner bonus's cards rise only after that card has left
  expect(firstLanded, 'a chip physically landed on the presented card').toBeGreaterThanOrEqual(0);
  expect(summary.landedOnStanding, 'the chip landed while the card stood (not leaving, not gone)').toBe(true);
  if (firstCovers >= 0) {
    expect(firstCovers, 'the owner bonus’s covers rose only after the card scene had left').toBeGreaterThan(lastStanding);
  }
  expect(summary.handStep, 'the mandatory discard ran as the embedded hand step').toBe(true);
  // ③ the Venus 8 % story waits for the board
  expect(summary.foreignRevealWhileColonies, 'no fullscreen reveal/viewer over the open workspace').toBe(0);
  expect(summary.strip8WhileColonies, 'the HUD holds 6 % while the workspace owns the screen').toBe(0);
  expect(summary.took, 'the 8 % card was presented over the board and taken').toBe(true);
  expect(summary.stripEnd).toBe('8%');
  expect(summary.stranded, 'the stranded-prompt guard never fired').toBe(0);
  expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
});
