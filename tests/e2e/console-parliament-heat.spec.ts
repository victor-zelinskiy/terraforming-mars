import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, press, pressUntil, settle, focusInfoZone,
} from './consoleStart';
import {armLeakWitness, enterSittingByPass, expectLawLeadsEffects, inspectWinningBill, parliament, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';
import {armWitness, witnessOf} from './witness';

/**
 * HEAT CAPTURE (Turmoil Redux, RX14) — the ONE e2e of the new mechanic: a law
 * that reaches into the ECONOMY of cards. Two moments of one journey, on one
 * profile (the owner's budget — one e2e per new mechanic):
 *
 *   PART 1 · THE SITTING (fixture `parliament-heat-assembly`): the inspector
 *   states the world part in the server's numbers («Температура: −20 °C →
 *   −24 °C»), the seat is paid («+4 M€»), the sitting STEPS ASIDE and the
 *   TEMPERATURE readout travels −20 → −24 while the board has the screen — a
 *   LOSS, no celebration, not one TR chip — and the results carry the PLANET
 *   line with the temperature step. This is RX12's tact with another
 *   parameter: the assertions are parity, not novelty.
 *
 *   PART 2 · THE DISCOUNT (fixture `parliament-heat-enacted`): the law stands,
 *   the viewer holds «Nuclear Power» (printed 10, a Building tag). The
 *   Information effects list carries the LAW's row; the play composer's
 *   payment head reads «10 → 7» with «−3»; the R3 «Эффекты» layer's discount
 *   group names the law — «Улавливание тепла», never «Прочие скидки» — and
 *   wears the Reds' emblem. The price is the server's (`getCardCostBreakdown`);
 *   the screen is checked against the wire.
 *
 * Screens under screenshots/parliament-heat/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-heat');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const HEAT_ID = 'RDX_REDS_HEAT_CAPTURE';
const BUILDING_CARD = 'Nuclear Power';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Outcome = {player?: string, step: string, part?: string, kind: string, amount?: number, unrewarded?: boolean,
  parameter?: {id: string, before: number, after: number}};
type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
  game: {temperature: number,
    parliament?: {phase?: {outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/**
 * THE PROBE — RECORDED off the product's own writes (FLAKE ZERO, `armWitness`; a still screen records nothing, a
 * starved renderer can slow the beat but never hide it between two ticks): whether the sitting's frame is on screen,
 * what the temperature readout SAYS, whether the terraforming readout is celebrating, and whether any TR delta chip
 * exists — every distinct state with the page's time. `settled`: «no chip while away» is read on what a task leaves.
 */
type Sample = {t: number, parl: boolean, temperature: string, celebrating: boolean, trChips: number};
type Probe = {samples: Array<Sample>};
const HEAT_PROBE = 'heat-probe';

async function armProbe(page: Page): Promise<void> {
  await armWitness<Omit<Sample, 't'>>(page, HEAT_PROBE, () => {
    const text = (icon: string): string => {
      const host = Array.from(document.querySelectorAll('.con-status__param'))
        .find((el) => el.querySelector(`.wgt-icon--${icon}`) !== null);
      return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
    };
    return {
      parl: document.querySelector('.con-parl') !== null,
      temperature: text('temperature'),
      celebrating: document.querySelector('.con-status__terra--celebrating') !== null,
      trChips: document.querySelectorAll('[data-metric-key="score.tr"] .delta-chip').length,
    };
  }, {settled: true});
}

const readProbe = async (page: Page): Promise<Probe> =>
  ({samples: (await witnessOf<Omit<Sample, 't'>>(page, HEAT_PROBE).samples()).map((s) => ({t: s.t, ...s.v}))});

const composer = (page: Page) => page.locator('.con-composer--play');
const layer = (page: Page) => page.locator('.con-composer__fxlayer');

/** Open the hand workspace and descend into `card`'s play composer (the forecast e2e's own route). */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  // RT → the quick wheel, then its centre slot → the hand screen — each press verified by what it opens.
  const handUp = async () => await page.locator('.con-hand').count() > 0;
  await pressUntil(page, 'Period', async () => await page.locator('.con-quick').count() > 0 || await handUp(), {tries: 5, settleMs: 600});
  await pressUntil(page, 'Enter', handUp, {tries: 5, settleMs: 1400});
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(24, slots * 3)), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

test.describe(`Heat Capture · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the temperature falls for nobody at the sitting; then a Building card is 3 M€ cheaper, and the law is named for it', async ({page, request}) => {
    test.setTimeout(900_000);

    // ════════════════ PART 1 · THE SITTING — RX12's world tact with the temperature ════════════════
    // The table stands ONE PASS before its sitting (the soft gates): the law leads the vote, the viewer holds its menu.
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-heat-assembly', {query: PRESET.query});
    await armLeakWitness(page);

    const before = await wireOf(request, playerId);
    expect(before.game.temperature, 'the fixture stands at −20 °C').toBe(-20);

    // ── ⓪ THE INSPECTION says what will happen to the world, in the server's own numbers — on the table, as voted.
    await inspectWinningBill(page);
    const rules = page.locator('dialog.con-zoom[open] .con-zoom-sidecol');
    await expect(rules).toContainText(/Что делает с планетой|What it does to the planet/);
    await expect(rules).toContainText(/Температура: -20°C → -24°C|Temperature: -20°C → -24°C/);
    // …and the PASSIVE is its own block: the discount is what the law does while it stands.
    await expect(rules).toContainText(/на 3 M€ меньше|3 M€ less/);
    await shoot(page, '01b-inspect-world');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    // ── THE PASS carries the whole sitting; it comes up and turns its pages by itself.
    await enterSittingByPass(page, request, playerId);
    await armProbe(page);
    await shoot(page, '01-sitting-up');

    // ── ① THE SEAT IS PAID FIRST: 2 M€ per influence, influence 2 → +4.
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [];
      return outcomes.find((o) => o.step === 'megacredits' && o.player === before.thisPlayer.color)?.amount;
    }, {timeout: 60_000, message: 'the seat\'s own 4 M€ is recorded'}).toBe(4);

    // ── ② THE SITTING STEPS ASIDE and ③ THE TEMPERATURE MARKER TRAVELS while it is away.
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl), {timeout: 60_000,
      message: 'the sitting left the screen for the board — «К полю», with no press'}).toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).game.temperature, {timeout: 60_000,
      message: 'the law lowered the temperature two steps'}).toBe(-24);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.parl && s.temperature.includes('-24')), {timeout: 60_000,
      message: 'the temperature readout shows −24 °C while the board has the screen'}).toBe(true);
    await shoot(page, '02-board-world-beat');

    // ── ④ NOT ONE TR CHIP, AND NO CELEBRATION, for the whole tact.
    const away = (await readProbe(page)).samples;
    expect(away.filter((s) => s.trChips > 0), 'no terraform-rating chip flies for a law that credits nobody').toEqual([]);
    expect(away.filter((s) => s.celebrating), 'a lowering is never celebrated').toEqual([]);
    const mid = await wireOf(request, playerId);
    expect(mid.thisPlayer.terraformRating - before.thisPlayer.terraformRating,
      'the winner gains at most its Agenda step — never anything for the world\'s move, and loses nothing').toBeGreaterThanOrEqual(0);
    expect(mid.thisPlayer.terraformRating - before.thisPlayer.terraformRating).toBeLessThanOrEqual(1);

    // ── ⑤ THE FRAME COMES BACK at the same depth, bounded…
    await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
    const walk = (await readProbe(page)).samples;
    const left = walk.find((s) => !s.parl)?.t ?? 0;
    // The record keeps a state only when it CHANGES: the away run ends at the moment the frame stood again (the first
    // state with it after the last one without it) — never at the last change seen while it was away.
    const lastAway = walk.map((s) => s.parl).lastIndexOf(false);
    const back = lastAway < 0 ? 0 : (walk.slice(lastAway + 1).find((s) => s.parl)?.t ?? walk[lastAway].t);
    test.info().annotations.push({type: 'world-beat', description: `away ${back - left} ms (cap 9000)`});
    expect(back - left, 'the sitting is away for the story, not for a timeout').toBeLessThan(9_000);
    await witnessOf(page, HEAT_PROBE).stop(); // the record's subject is this tact — PART 2 boots another table
    await waitSittingAtRest(page, 60_000);
    await shoot(page, '03-back-from-the-board');

    // …and the RESULTS carry the planet line: the temperature step, and that nobody is credited.
    await expect.poll(() => sittingStage(page), {timeout: 90_000, message: 'the walk reaches the results'}).toBe('results');
    const planet = page.locator('[data-sit-section="planet"] [data-sit-planet]');
    await expect(planet, 'one line member per world move').toHaveCount(1);
    await expect(planet.nth(0)).toHaveAttribute('data-sit-planet-param', 'temperature');
    await expect(planet.nth(0)).toHaveAttribute('data-sit-planet-steps', '-2');
    await expect(planet.nth(0)).toContainText('-20');
    await expect(planet.nth(0)).toContainText('-24');
    await expect(page.locator('[data-sit-planet-notr]'), 'the one fact the scales cannot state').toHaveCount(1);
    await shoot(page, '04-results-planet');
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);

    // ════════════════ PART 2 · THE DISCOUNT — the law stands, a Building card is cheaper ════════════════
    const enacted = await bootFixtureSeats(page, request, 'parliament-heat-enacted');
    const viewer = enacted.playerId;
    const wire = await wireOf(request, viewer);
    const held = wire.cardsInHand?.find((c) => c.name === BUILDING_CARD);
    expect(held, 'the viewer holds Nuclear Power').toBeTruthy();
    expect(held?.calculatedCost, 'the SERVER prices it 10 − 3 = 7 — the one price function').toBe(7);

    // ── ⑥ THE EFFECTS LIST names the law — Information → the effects zone → the explorer's Parliament strip.
    const infoRoot = page.locator('.con-info');
    for (let i = 0; i < 8 && await infoRoot.count() === 0; i++) {
      if (i > 0) {
        await press(page, 'Enter', 700);
        await press(page, 'Escape', 500);
      }
      // Y, verified by the Information mode itself — given its whole window before the next round.
      await pressUntil(page, 'KeyY', async () => await infoRoot.count() > 0, {tries: 1, settleMs: 1100});
    }
    await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
    // The dossier is two tiers (TR60): the driver walks the zones' own geometry, never a memorised key sequence.
    expect(await focusInfoZone(page, 'effects'), 'the effects zone takes the focus').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
    // «Один фреймворк»: the law is a GROUP of the explorer's grid, and it leads it.
    await expectLawLeadsEffects(page, {id: HEAT_ID, name: /Улавливание тепла|Heat Capture/i});
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '05-effects-strip');
    // B one level per press, each given its whole window before the next.
    await pressUntil(page, 'Escape', async () => await page.locator('.con-info, .con-efx').count() === 0, {tries: 6, settleMs: 700});
    await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

    // ── ⑦ THE PAYMENT HEAD: «ЦЕНА 10 → 7» with «−3» — the composer reads the same breakdown the server charges.
    await openPlayComposer(page, BUILDING_CARD);
    const head = page.locator('.con-composer--play .con-pay__head');
    await expect(head.locator('[data-pay-base]')).toHaveText('10');
    await expect(head.locator('.con-pay__price-value')).toHaveText('7');
    await expect(head.locator('[data-pay-saved]')).toHaveText('−3');
    await shoot(page, '06-play-discount');

    // ── ⑧ THE R3 LAYER names the LAW on the discount line — never «Прочие скидки» — and wears its party's emblem.
    expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100}),
      'R3 must open the «Эффекты» layer').toBeTruthy();
    const discountTile = layer(page).locator('[data-forecast-item="discount"]');
    await expect(discountTile, 'ONE discount line — the law\'s').toHaveCount(1);
    await expect(discountTile.locator('.con-efx__tile-src')).toHaveText(/Улавливание тепла|Heat Capture/i);
    await expect(discountTile.locator('.con-efx__tile-src')).not.toHaveText(/Прочие скидки|Other discounts/i);
    await expect(discountTile.locator('.con-efx__party-emblem'), 'the Reds\' emblem where a card\'s graphic would stand').toHaveCount(1);
    await expect(discountTile.locator('.con-efx__meta-num')).toHaveText('−3');
    await expect(layer(page).locator('[data-forecast-item="other-discount"]'), 'nothing left unnamed').toHaveCount(0);
    await shoot(page, '07-forecast-law');

    // Back out without playing: the journey is the price and its explanation, not the play.
    await pressUntil(page, 'Escape', async () => await page.locator('.con-composer__fxlayer, .con-composer--play, .con-hand').count() === 0,
      {tries: 6, settleMs: 700});
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
