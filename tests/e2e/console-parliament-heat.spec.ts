import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle,
} from './consoleStart';
import {answerGateAs, armLeakWitness, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

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
 * THE PROBE. A `setInterval` sampler (never rAF — a quiet screen stops the
 * compositor exactly when this beat plays) that reads, every tick: whether the
 * sitting's frame is on screen, what the temperature readout SAYS, whether the
 * terraforming readout is celebrating, and whether any TR delta chip exists.
 */
type Sample = {t: number, parl: boolean, temperature: string, celebrating: boolean, trChips: number};
type Probe = {samples: Array<Sample>};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__heatProbe?: Probe};
    const probe: Probe = {samples: []};
    w.__heatProbe = probe;
    const text = (icon: string): string => {
      const host = Array.from(document.querySelectorAll('.con-status__param'))
        .find((el) => el.querySelector(`.wgt-icon--${icon}`) !== null);
      return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
    };
    const take = (): void => {
      probe.samples.push({
        t: Math.round(performance.now()),
        parl: document.querySelector('.con-parl') !== null,
        temperature: text('temperature'),
        celebrating: document.querySelector('.con-status__terra--celebrating') !== null,
        trChips: document.querySelectorAll('[data-metric-key="score.tr"] .delta-chip').length,
      });
      if (probe.samples.length > 4000) {
        probe.samples.splice(0, 2000);
      }
    };
    take();
    setInterval(take, 40);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__heatProbe: Probe}).__heatProbe);

const composer = (page: Page) => page.locator('.con-composer--play');
const layer = (page: Page) => page.locator('.con-composer__fxlayer');

/** Open the hand workspace and descend into `card`'s play composer (the forecast e2e's own route). */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
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
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-heat-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);

    const before = await wireOf(request, playerId);
    expect(before.game.temperature, 'the fixture stands at −20 °C').toBe(-20);
    await shoot(page, '01-verdict');

    // ── ⓪ THE INSPECTION says what will happen to the world, in the server's own numbers.
    await openZoomViewer(page);
    const rules = page.locator('dialog.con-zoom[open] .con-zoom-sidecol');
    await expect(rules).toContainText(/Что делает с планетой|What it does to the planet/);
    await expect(rules).toContainText(/Температура: -20°C → -24°C|Temperature: -20°C → -24°C/);
    // …and the PASSIVE is its own block: the discount is what the law does while it stands.
    await expect(rules).toContainText(/на 3 M€ меньше|3 M€ less/);
    await shoot(page, '01b-inspect-world');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    await armProbe(page);

    // ── GATE 1: A on the verdict; red answers over the API. Everything after this turns by itself.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

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
    const back = [...walk].reverse().find((s) => !s.parl)?.t ?? 0;
    test.info().annotations.push({type: 'world-beat', description: `away ${back - left} ms (cap 9000)`});
    expect(back - left, 'the sitting is away for the story, not for a timeout').toBeLessThan(9_000);
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
      await press(page, 'KeyY', 1100);
    }
    await expect(infoRoot, 'the Information mode opens').toHaveCount(1);
    const effectsFocused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
    for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown']) {
      if (await effectsFocused() > 0) {
        break;
      }
      await press(page, move, 300);
    }
    expect(await effectsFocused(), 'the effects zone takes the focus').toBeGreaterThan(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx').count() > 0, {tries: 3, settleMs: 1100}), 'the effects explorer opens').toBe(true);
    const strip = page.locator('.con-pfx');
    await expect(strip, 'the Parliament strip stands in the explorer').toHaveCount(1, {timeout: 10_000});
    const law = strip.locator('.con-pfx__item').first();
    await expect(law, 'the LAW leads the strip').toHaveClass(/con-pfx__item--resolution/);
    await expect(law).toHaveAttribute('data-resolution', HEAT_ID);
    await expect(law.locator('.con-pfx__why b'), 'titled by the card').toHaveText(/Улавливание тепла|Heat Capture/i);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '05-effects-strip');
    for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
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
    for (let i = 0; i < 6 && await page.locator('.con-composer__fxlayer, .con-composer--play, .con-hand').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
