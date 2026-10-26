import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, press, settle} from './consoleStart';

/**
 * THE SPLIT TRADE — the trade and its colony bonus pay DIFFERENT cards, and the trade lands SMOOTHLY
 * (the owner's polish of 2026-10-25, fixture `titan-split-trade`: blue's cube on Titan, Dirigibles 1 and Aerial
 * Mappers 0, the marker on cell 4 → the income is 2 floaters, the bonus 1).
 *
 *   A · NOTHING MOVES UNDER THE FLEET — from the press to the ship's rest the planet, the berth and the stage's
 *       surface keep their boxes (±1 px): the verdict's box is reserved past the commit, the panel does not grow
 *       for a payout that is not a draw; and the flight's last frame IS the berth — the proxy's centre on the
 *       slot's centre, its size the slot's.
 *   B · THE RECEIVING CARDS ARE PROTAGONISTS — two faces, each naming who pays it («Торговая награда +2»,
 *       «Бонус колонии +1»), each at least half the scene's height, inside the scene, never overlapping.
 *   C · THE WAVES GO IN TURN — the income's card stands forward while the bonus's waits, then they swap; the
 *       income's card has all its tokens before the bonus's card receives its first; level once both are done.
 *
 * Probe: `MutationObserver` + `setInterval` in the page (never rAF — headless drives rAF off the compositor).
 * Evidence → screenshots/titan-split/<profile>/.
 */

/** The product's main profile only (tests.md § A CARD / FEATURE SPEC RUNS ITS TABLE ON THE TV PROFILE ONLY). */
const PROFILES = [
  {name: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Box = {x: number, y: number, w: number, h: number};
type Cell = {card: string, state: string, done: boolean, landed: boolean, top: Box, card_: Box, roles: string};
type Sample = {
  t: number,
  planet: Box | null,
  berth: Box | null,
  surface: Box | null,
  ship: Box | null,
  occupied: boolean,
  cardland: Box | null,
  leaving: boolean,
  cls: string,
  cells: Array<Cell>,
  landings: string,
};
type Probe = {samples: Array<Sample>, ticks: number};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__split?: Probe};
    w.__split = {samples: [], ticks: 0};
    const box = (el: Element | null): Box | null => {
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return r.width < 1 && r.height < 1 ? null : {x: r.x, y: r.y, w: r.width, h: r.height};
    };
    const t0 = performance.now();
    const sample = () => {
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        planet: box(document.querySelector('.con-colfocus .con-colfocus__planet')),
        berth: box(document.querySelector('.con-colfocus [data-fleet-berth="Titan"]')),
        surface: box(document.querySelector('.con-colfocus .con-colfocus__surface')),
        ship: box(document.querySelector('.con-fleet-ship')),
        occupied: document.querySelector('.con-colfocus .con-colfocus__orbit--occupied') !== null,
        cardland: box(document.querySelector('.con-colfocus__cardland')),
        leaving: document.querySelector('.con-colfocus__cardland--leaving') !== null,
        cls: (document.querySelector('.con-colfocus')?.className ?? '').replace(/con-colfocus--/g, '').replace(/s+/g, ' ').trim() + ' | verdict=' + (document.querySelector('.con-colfocus__verdict') !== null) + ' hero-h=' + Math.round(document.querySelector('.con-colfocus__hero')?.getBoundingClientRect().height ?? 0),
        cells: Array.from(document.querySelectorAll('.con-colfocus__landcell')).map((c) => ({
          card: c.getAttribute('data-played-key') ?? '',
          state: c.getAttribute('data-landcell-state') ?? '',
          done: c.classList.contains('con-colfocus__landcell--done'),
          landed: c.classList.contains('con-colfocus__landcell--landed'),
          top: box(c)!,
          card_: box(c.querySelector('.con-colfocus__landcard'))!,
          roles: Array.from(c.querySelectorAll('[data-landrole]')).map((r) => `${r.getAttribute('data-landrole')}:${(r.textContent ?? '').replace(/\s+/g, ' ').trim()}`).join('|'),
        })),
        landings: JSON.stringify((window as unknown as {__conColonyDiag?: () => {trade: {landings: unknown}}}).__conColonyDiag?.()?.trade.landings ?? {}),
      };
      w.__split!.ticks++;
      w.__split!.samples.push(s);
      if (w.__split!.samples.length > 8000) {
        w.__split!.samples.splice(0, 1000);
      }
    };
    sample();
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-landcell-state']});
    window.setInterval(sample, 30);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__split: Probe}).__split);

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTitan(page: Page): Promise<void> {
  const focused = page.locator('.con-coltile--focused[data-test="con-colony-Titan"]');
  for (let i = 0; i < 6 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 6 && await focused.count() === 0; i++) {
    await press(page, 'ArrowLeft', 380);
  }
  expect(await focused.count(), 'could not focus Titan').toBeGreaterThan(0);
}

/** The focused review row: its text, and whether it still waits for an answer. */
const focusedRow = (page: Page) => page.evaluate(() => {
  const row = document.querySelector('.con-colfocus__steprow--focused');
  return {text: (row?.textContent ?? '').toUpperCase(), missing: row?.classList.contains('con-colfocus__steprow--missing') ?? false};
});

const focusedCandidate = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector('.con-ptsel__slot--focused .pcard')?.closest('[data-ptsel-cell]')?.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');

/** Answer the next unanswered «ЦЕЛЬ» row with the named holder. */
async function answerTarget(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const row = await focusedRow(page);
    if (row.text.includes('ЦЕЛЬ') && row.missing) {
      break;
    }
    await press(page, 'ArrowDown', 320);
  }
  const row = await focusedRow(page);
  expect(row.text.includes('ЦЕЛЬ') && row.missing, `an unanswered target row must take focus (got «${row.text}»)`).toBe(true);
  await press(page, 'Enter', 1200);
  await expect(page.locator('.con-colfocus__targetstage'), 'the embedded target step stands').toHaveCount(1, {timeout: 6000});
  for (let i = 0; i < 6 && (await focusedCandidate(page)) !== card; i++) {
    await press(page, 'ArrowRight', 420);
  }
  expect(await focusedCandidate(page), `the cursor reached ${card}`).toBe(card);
  await press(page, 'Enter', 1100);
  await expect(page.locator('.con-colfocus__targetstage'), 'the pick returns to the review').toHaveCount(0, {timeout: 6000});
}

const drift = (a: Box | null, b: Box | null): number =>
  a === null || b === null ? 0 : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));

for (const profile of PROFILES) {
  test.describe(`titan split trade · ${profile.name}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    test('the fleet lands on a still stage; two receiving cards are paid in turn, at the scene\'s scale', async ({page, request}) => {
      test.setTimeout(360_000);
      const out = path.resolve('screenshots', 'titan-split', profile.name);
      fs.mkdirSync(out, {recursive: true});
      const shoot = (name: string) => page.screenshot({path: path.join(out, `${name}.png`)});

      await bootFixture(page, request, 'titan-split-trade', {keepColony: 'Titan', query: profile.query});
      await settle(page);
      await openColonies(page);
      await focusTitan(page);
      await press(page, 'Enter', 2000);
      await expect(page.locator('.con-colfocus'), 'the trade stage opens').toHaveCount(1, {timeout: 8000});

      await answerTarget(page, 'Dirigibles');
      await answerTarget(page, 'Aerial Mappers');
      await expect(page.locator('.con-colfocus__steprow--missing'), 'every target answered').toHaveCount(0, {timeout: 6000});
      await settle(page); // the review settles after the last answer
      await shoot('01-review');

      await armProbe(page);
      await press(page, 'KeyX', 200); // trade

      await expect.poll(async () => (await readProbe(page)).samples.some((s) => s.cells.length === 2),
        {timeout: 30_000, message: 'the two receiving cards stand on the stage'}).toBe(true);
      await shoot('02-receiving');
      // A moment with BOTH cards paid in full — read over the probe's samples, never the last one alone: the paid cards
      // stand for one read and then leave with the finished trade, so a poll that lands after that window found a stage
      // with no cards at all and could never pass again (CI run 40306704981, 3/3).
      await expect.poll(async () => (await readProbe(page)).samples
        .some((s) => s.cells.length === 2 && s.cells.every((c) => c.done)),
      {timeout: 30_000, message: 'both cards have all their tokens'}).toBe(true);
      await shoot('03-landed');
      await expect.poll(() => page.locator('.con-colonies').count(), {timeout: 60_000, message: 'the finished trade leaves'}).toBe(0);

      const {samples, ticks} = await readProbe(page);
      expect(ticks, 'the probe sampled (anti-vacuous)').toBeGreaterThan(40);
      const base = samples[0];
      expect(base.planet !== null && base.berth !== null && base.surface !== null, 'the stage stood measurable at the press').toBe(true);

      // ── A · nothing moves under the fleet, and the flight ends on the berth. ──
      const docked = samples.findIndex((s) => s.occupied);
      expect(docked, 'the berth was occupied').toBeGreaterThan(0);
      const flight = samples.slice(0, docked + 1);
      const worst = (key: 'planet' | 'berth' | 'surface') => Math.max(...flight.map((s) => drift(base[key], s[key])));
      console.log(`[${profile.name}] drift press→dock: planet ${worst('planet').toFixed(2)} berth ${worst('berth').toFixed(2)} surface ${worst('surface').toFixed(2)} px`);
      // The timeline of every change of the planet's box — names WHEN it moved and what the stage was doing.
      let prev = base.planet;
      for (const s of flight) {
        if (drift(prev, s.planet) > 0.5) {
          console.log(`[${profile.name}]   t=${s.t} planet ${JSON.stringify(s.planet)} ship=${s.ship !== null} occupied=${s.occupied} cards=${s.cells.length} cls=${s.cls}`);
          prev = s.planet;
        }
      }
      expect(worst('planet'), 'the planet never moves under the landing').toBeLessThanOrEqual(1);
      expect(worst('berth'), 'the berth never moves under the landing').toBeLessThanOrEqual(1);
      expect(worst('surface'), 'the stage\'s surface never moves under the landing').toBeLessThanOrEqual(1);
      const lastShip = flight.filter((s) => s.ship !== null).at(-1);
      expect(lastShip, 'the proxy was sampled in flight').toBeDefined();
      const berth = lastShip!.berth!;
      const ship = lastShip!.ship!;
      const centreGap = Math.hypot((ship.x + ship.w / 2) - (berth.x + berth.w / 2), (ship.y + ship.h / 2) - (berth.y + berth.h / 2));
      console.log(`[${profile.name}] last proxy frame: centre gap ${centreGap.toFixed(2)} px · size ${ship.w.toFixed(1)} vs slot ${berth.w.toFixed(1)}`);
      expect(centreGap, 'the proxy\'s last frame stands on the berth\'s centre').toBeLessThanOrEqual(2);
      expect(Math.abs(ship.w - berth.w) / berth.w, 'the proxy\'s last frame is the berth\'s size').toBeLessThanOrEqual(0.12);

      // ── B · two protagonists, named, inside the scene. ──
      const standing = samples.filter((s) => s.cells.length === 2 && s.cardland !== null && !s.leaving);
      const read = standing.at(-1)!;
      const scene = read.cardland!;
      const income = read.cells.find((c) => c.roles.includes('tradeReward'));
      const bonus = read.cells.find((c) => c.roles.includes('colonyBonus'));
      // Which card each act pays is the player's answer (the review's row order decides which is asked first).
      expect(income, 'one card names the trade reward').toBeDefined();
      expect(bonus, 'the other names the colony bonus').toBeDefined();
      expect(income!.card, 'the two acts pay DIFFERENT cards').not.toBe(bonus!.card);
      const incomeCard = income!.card;
      const bonusCard = bonus!.card;
      expect(income!.roles, 'the income reads its amount').toContain('+2');
      expect(bonus!.roles, 'the bonus reads its amount').toContain('+1');
      for (const cell of read.cells) {
        console.log(`[${profile.name}] ${cell.card}: card ${cell.card_.w.toFixed(0)}×${cell.card_.h.toFixed(0)} in a scene ${scene.w.toFixed(0)}×${scene.h.toFixed(0)}`);
        expect(cell.card_.h / scene.h, `${cell.card} stands at the scene's scale`).toBeGreaterThanOrEqual(0.5);
        expect(cell.top.x >= scene.x - 1 && cell.top.y >= scene.y - 1 && cell.top.x + cell.top.w <= scene.x + scene.w + 1 &&
          cell.top.y + cell.top.h <= scene.y + scene.h + 1, `${cell.card} stands inside the scene`).toBe(true);
      }
      const [a, b] = read.cells.map((c) => c.top);
      expect(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1, 'the two cards never overlap').toBe(true);

      // ── C · in turn: the income's card forward, then the bonus's; level at the end. ──
      const state = (s: Sample, card: string) => s.cells.find((c) => c.card === card)?.state ?? '';
      const incomeFirst = standing.findIndex((s) => state(s, incomeCard) === 'receiving' && state(s, bonusCard) === 'waiting');
      const bonusTurn = standing.findIndex((s) => state(s, bonusCard) === 'receiving' && state(s, incomeCard) === 'waiting');
      expect(incomeFirst, 'the income\'s card stood forward first').toBeGreaterThanOrEqual(0);
      expect(bonusTurn, 'then the bonus\'s card').toBeGreaterThan(incomeFirst);
      const firstBonusLanding = standing.findIndex((s) => s.cells.find((c) => c.card === bonusCard)?.landed === true);
      const incomeDone = standing.findIndex((s) => s.cells.find((c) => c.card === incomeCard)?.done === true);
      expect(incomeDone, 'the income landed whole').toBeGreaterThanOrEqual(0);
      expect(firstBonusLanding, 'the bonus lands only after the income has').toBeGreaterThan(incomeDone);
      expect(firstBonusLanding, 'the bonus lands on a card already standing forward').toBeGreaterThanOrEqual(bonusTurn);
      expect(read.cells.every((c) => c.state === 'idle'), 'level once everything has landed').toBe(true);
    });
  });
}
