import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle, waitForBoardHome,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness, TransferWitness} from './transferWitness';

/**
 * THE POLISH REMEDIATION ITERATION № 1 — the owner's two P0 classes on ONE Venus
 * table (fixture `aerial-mappers`: Aerial Mappers ×1 floater, Dirigibles ×2,
 * Caretaker Contract, 8 heat, Venus Governor in hand on 3 M€).
 *
 *  (A) P0-A — A READING WITH PARAMS IS NEVER A RAW TEMPLATE (PL-160). «Действия
 *      карт» → «Карта ветров» → the «add 1 floater to ANY card» variant → the
 *      target step: the rail reads «Потратьте 1 отсюда: +1 карту» for «Эта
 *      карта»; the pick answered, the composer's own target row reads the SAME
 *      line — never `${0}` (the owner's TV photo, 2026-10-10). Then the target
 *      changed to Dirigibles and A: the «+1» floater is born on the hero's printed
 *      floater and lands on Dirigibles' miniature IN THE COMPOSER ROW while the
 *      workspace stands; the server agrees (Dirigibles 3, Mappers 1).
 *  (B) P0-B — THE ENDS OF A FLIGHT ARE VISIBLE. Hand → Venus Governor: the
 *      floater lane pays one (3 M€ < 4): the «−1» floater token's ends are both
 *      painted on something the player can see (never a band surface's glass,
 *      never nothing); the server agrees (Dirigibles 1, 2 M€, the card played).
 *  (C) P0-B, the loss-only chain (PL-142 generalized): Caretaker Contract's
 *      «−8» heat leaves the heat row's ink, is absorbed at the hero's printed
 *      heat while the workspace still stands; the «+1» rating is born on the
 *      hero and lands on the TR cell; no end over glass.
 *
 * Every scene can be storyboarded (`TM_E2E_STORYBOARD=1` → `screenshots/aerial-mappers/<profile>/story-*`);
 * the transfer witness's trail is written beside the frames on every run. Heavy 4K: `--workers=1`.
 */

const CARD = 'Aerial Mappers';
const DIRIGIBLES = 'Dirigibles';
const CARETAKER = 'Caretaker Contract';
const GOVERNOR = 'Venus Governor';
/** `TM_E2E_SHOTS_TAG=before|after` keeps two runs' frames apart (the iteration's A/B evidence); unset → the root. */
const OUT = path.resolve('screenshots', 'aerial-mappers', process.env.TM_E2E_SHOTS_TAG ?? '');
const RAW = /\$\{/;
/** «Потратьте 1 отсюда: +1» + the tail «карта» (the `card` key) — textContent joins the two spans without a space. */
const VALUE_LINE = /Потратьте 1 отсюда: \+1\s*карт/;

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, heat: number, megacredits: number, terraformRating: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const countOf = (w: Wire, card: string) => w.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

function writeTrail(preset: string, name: string, w: TransferWitness): void {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  fs.writeFileSync(path.join(OUT, preset, `trail-${name}.txt`), transferTrail(w) + '\n');
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

const composer = '.con-cardactions .con-composer';
const text = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
const tileFocused = (page: Page, card: string) => page.evaluate((name) =>
  document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') === name, card);

/** «Действия карт» → the card's tile → its composer. */
async function openComposer(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  // The grid is two-dimensional: a cycle of → → ↓ ← ← ↓ reaches every tile of a small table (memory `e2e-action-centre-grid-walk`).
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !(await tileFocused(page, card)); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await tileFocused(page, card), `never focused «${card}» (at «${await focusedTile(page)}»)`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(composer), 'the composer stands').toBeVisible();
}

const focusedRow = (page: Page) => text(page, `${composer} .con-composer__row--focused`);

/** Walk the composer's cursor (↑ / ↓) until `ok` holds. */
async function walkComposer(page: Page, ok: () => Promise<boolean>, label: string): Promise<void> {
  for (const key of ['ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 8; i++) {
      if (await ok()) {
        return;
      }
      await press(page, key, 220);
    }
  }
  expect(await ok(), `the composer's cursor never reached ${label} (at «${await focusedRow(page)}»)`).toBe(true);
}

/** The played-target step's focused candidate: 'self' for the «Эта карта» proxy, else the card's name. */
const focusedCandidate = (page: Page) => page.evaluate(() => {
  const cell = document.querySelector('.con-ptsel__cell[data-focused="1"]');
  if (cell === null) {
    return '';
  }
  return cell.querySelector('[data-ptsel-self]') !== null ? 'self' : (cell.querySelector('[data-zoom-slot]')?.getAttribute('data-zoom-slot') ?? '');
});

/** A on a card-pick row → the played-target step → walk to `want` ('self' or a card's name); the step stays OPEN. */
async function openPick(page: Page, rowLabel: RegExp, want: string): Promise<void> {
  await walkComposer(page, async () => rowLabel.test(await focusedRow(page)), `the row ${rowLabel}`);
  await press(page, 'Enter', 500);
  await expect(page.locator('.con-ptsel'), 'the played-target step opened').toBeVisible();
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    for (let i = 0; i < 6 && !(await focusedCandidate(page)).includes(want); i++) {
      await press(page, key, 220);
    }
  }
  expect(await focusedCandidate(page), `the step's cursor reached ${want}`).toContain(want);
}

async function answerPick(page: Page): Promise<void> {
  await press(page, 'Enter', 500);
  await expect(page.locator('.con-ptsel'), 'the step answered and closed').toHaveCount(0);
}

async function toCommitRow(page: Page): Promise<void> {
  for (let i = 0; i < 8 && await page.locator(`${composer} .con-composer__cta--focused`).count() === 0; i++) {
    await press(page, 'ArrowDown', 200);
  }
  await expect(page.locator(`${composer} .con-composer__cta--focused`), 'the cursor stands on the commit row').toHaveCount(1);
}

/** The workspace is gone and the board is home (the scene's end). */
async function waitSceneEnd(page: Page): Promise<void> {
  await expect(page.locator('.con-ws'), 'the workspace left').toHaveCount(0, {timeout: 40_000});
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.con-transfer__chip').length), {timeout: 20_000}).toBe(0);
  await settle(page, {timeoutMs: 30_000});
  await waitForBoardHome(page, 30);
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  const play = page.locator('.con-composer--play');
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1400);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await play.count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

for (const preset of PRESETS) {
  test.describe(`polish remediation 1 · Aerial Mappers · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1});

    test(`(A) the target step and the composer's answered row print the value line with its params — never a raw template; +1 floater onto Dirigibles lands on its miniature (${preset.id})`, async ({page, request}) => {
      const {playerId} = await bootFixtureSeats(page, request, 'aerial-mappers', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(countOf(before, CARD), 'the fixture: one floater on the card').toBe(1);
      expect(countOf(before, DIRIGIBLES), 'the fixture: two floaters on Dirigibles').toBe(2);

      await openComposer(page, CARD);
      // The `or` is autoSelect: the composer opens on the add-to-ANY-card variant («1/2 ВАРИАНТ»), its target row first.
      await expect(page.locator(`${composer} .con-composer__row--focused`), 'the target row stands').toContainText(/получател/i);
      await openPick(page, /получател/i, 'self');
      const rail = await text(page, '.con-ptsel__rail');
      // SOFT: the scene after these readings must still play (the BEFORE run of the iteration needs its trail too).
      expect.soft(rail, 'the step\'s rail prints the value line WITH its params').toMatch(VALUE_LINE);
      expect.soft(rail, 'no raw template on the rail (PL-160)').not.toMatch(RAW);
      await shoot(page, preset.id, 'a1-step-self');
      await answerPick(page);
      const row = await text(page, `${composer} .con-composer__target`);
      expect.soft(row, 'the composer\'s answered row prints the SAME value line (the owner\'s photo printed «${0}»)').toMatch(VALUE_LINE);
      expect.soft(row, 'no raw template in the answered row (PL-160)').not.toMatch(RAW);
      await shoot(page, preset.id, 'a2-composer-self');

      // Change the target to Dirigibles — a card the composer draws as a miniature in its row.
      await openPick(page, /получател/i, DIRIGIBLES);
      await answerPick(page);
      await expect(page.locator(`${composer} [data-composer-card="${DIRIGIBLES}"]`), 'Dirigibles stands in the target row').toHaveCount(1);
      await toCommitRow(page);
      await shoot(page, preset.id, 'a3-ready');

      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'a-floater-to-dirigibles');
      await press(page, 'Enter', 300);
      await waitSceneEnd(page);
      await stop();
      const w = await transferWitness(page);
      writeTrail(preset.id, 'a', w);
      const plus = w.births.filter((e) => e.value === '+1');
      expect(plus.length, `a «+1» floater token was born (trail:\n${transferTrail(w)})`).toBeGreaterThanOrEqual(1);
      expect(plus[0].under, 'born on the hero (its printed floater)').toBe('hero');
      const landed = w.landings.find((e) => e.id === plus[0].id);
      expect(landed, 'the token landed').toBeTruthy();
      expect(landed!.under, 'landed on Dirigibles\' miniature in the composer row — the workspace still standing').toBe(`composer-card:${DIRIGIBLES}`);
      expect(endsOverGlass(w), 'no end of any flight over a band surface\'s glass').toEqual([]);

      const after = await wireOf(request, playerId);
      expect(countOf(after, DIRIGIBLES), 'the server: Dirigibles 3').toBe(3);
      expect(countOf(after, CARD), 'the server: Aerial Mappers still 1').toBe(1);
      await shoot(page, preset.id, 'a4-after');
    });

    test(`(B) a floater pays for Venus Governor: the «−1» token's ends are both painted on something visible (${preset.id})`, async ({page, request}) => {
      const {playerId} = await bootFixtureSeats(page, request, 'aerial-mappers', {query: preset.query});
      await openPlayComposer(page, GOVERNOR);
      const row = page.locator('.con-composer--play .con-payrow[data-pay-unit="floaters"]');
      await expect(row, 'the floater lane stands on a Venus card').toHaveCount(1);
      await expect(row.locator('.con-payrow__used'), 'one floater pays by default (3 M€ < 4)').toHaveText('1');
      await expect(page.locator('.con-composer--play .con-paystatus'), 'exact').toHaveClass(/con-paystatus--exact/);
      await shoot(page, preset.id, 'b1-payment');

      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'b-floater-pays');
      await press(page, 'Enter', 300);
      await expect(page.locator('.con-composer--play'), 'the play composer is gone').toHaveCount(0, {timeout: 40_000});
      await waitSceneEnd(page);
      await stop();
      const w = await transferWitness(page);
      writeTrail(preset.id, 'b', w);
      expect(endsOverGlass(w), 'no end of any flight over a band surface\'s glass or over nothing').toEqual([]);
      const after = await wireOf(request, playerId);
      expect(countOf(after, DIRIGIBLES), 'the server: one floater left Dirigibles').toBe(1);
      expect(after.thisPlayer.megacredits, 'the server: 3 − 1 M€').toBe(2);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the governor was played').toContain(GOVERNOR);
      await shoot(page, preset.id, 'b2-after');
      // PL-163 (OPEN, the polish remediation iteration № 1): a price paid with a CARD resource has no flight and no
      // visible cause today — the satellite ticks under the hand's glass. Its honest form under the law of visible
      // ends is a token off the PAY ROW's icon (the satellite's visible double) into the card's cost badge. Until it
      // ships this test is a fixme past this line, never a green that proves nothing.
      const minus = w.births.filter((e) => e.value === '−1');
      test.fixme(minus.length === 0, `PL-163 — the «−1» floater price has no flight yet (trail:\n${transferTrail(w)})`);
      expect(minus[0].under, 'born on a visible double of the satellite — the pay row').toMatch(/^payrow:/);
    });

    test(`(C) Caretaker Contract: the «−8» heat leaves the rail into the hero's printed heat while the workspace stands; the «+1» rating lands on the TR cell (${preset.id})`, async ({page, request}) => {
      const {playerId} = await bootFixtureSeats(page, request, 'aerial-mappers', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.heat, 'the fixture: 8 heat').toBe(8);

      await openComposer(page, CARETAKER);
      await toCommitRow(page);
      await shoot(page, preset.id, 'c1-ready');
      await armTransferWitness(page);
      const stop = await storyboard(page, preset.id, 'c-heat-price');
      await press(page, 'Enter', 300);
      await waitSceneEnd(page);
      await stop();
      const w = await transferWitness(page);
      writeTrail(preset.id, 'c', w);
      const price = w.births.find((e) => e.value === '−8');
      expect(price, `the «−8» heat token was born (trail:\n${transferTrail(w)})`).toBeTruthy();
      expect(price!.under, 'born on the heat row').toBe('rail:heat');
      const absorbed = w.landings.find((e) => e.id === price!.id);
      expect(absorbed, 'the price token was absorbed').toBeTruthy();
      expect(absorbed!.under, 'absorbed on the hero (its printed heat) — the workspace still standing (PL-142)').toBe('hero');
      const rating = w.births.find((e) => e.value === '+1');
      expect(rating, 'the «+1» rating token was born').toBeTruthy();
      expect(absorbed!.touched, 'the price token touched down (its contact beat played)').toBeDefined();
      expect(rating!.t, 'the rating is born on the touchdown of the price, never before it').toBeGreaterThanOrEqual((absorbed!.touched ?? absorbed!.t) - 60);
      const ratingLanded = w.landings.find((e) => e.id === rating!.id);
      expect(ratingLanded?.under, 'the rating lands on the TR cell').toBe('rail:tr');
      expect(endsOverGlass(w), 'no end of any flight over a band surface\'s glass').toEqual([]);

      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.heat, 'the server: 0 heat').toBe(0);
      expect(after.thisPlayer.terraformRating, 'the server: +1 TR').toBe(before.thisPlayer.terraformRating + 1);
      await shoot(page, preset.id, 'c2-after');
    });
  });
}
