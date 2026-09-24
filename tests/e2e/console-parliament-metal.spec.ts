import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openMandatoryAnnounce, openZoomViewer, press, pressUntil, settle,
} from './consoleStart';
import {answerGateAs, armLeakWitness, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

/**
 * METAL RESEARCH (Turmoil Redux, RX19) — the ONE e2e of the new mechanic: a
 * law that changes the VALUE OF A RESOURCE. Two moments of one journey, on one
 * profile (the owner's budget — one e2e per new mechanic):
 *
 *   PART 1 · THE SITTING (fixture `parliament-metal-assembly`): the rail's
 *   value badges read «2» / «3» before the enactment; the inspector states the
 *   passive; the seat is paid its two parts (2 steel, 2 titanium); and THE
 *   FRAME OF THE ITERATION — the badges read «3» / «4» the moment the law
 *   stands, on the same screen, with no reload and no press: the server's
 *   accessor adds the bonus on the read, the model carries it, the badge
 *   restates the model. Nothing of the law is coded on the client.
 *
 *   PART 2 · THE PRICE (fixture `parliament-metal-enacted`): the law stands,
 *   the viewer holds «Nuclear Power» (printed 10, a Building tag) and steel.
 *   The Information effects list carries the LAW's row; the play composer's
 *   head reads the printed 10 (a value is not a discount); and the steel row
 *   of the payment panel reads «×3» — the same number the badge shows, the
 *   same number `payingAmount` charges by.
 *
 * Screens under screenshots/parliament-metal/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-metal');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const METAL_ID = 'RDX_INDUSTRIALISTS_METAL_RESEARCH';
const BUILDING_CARD = 'Nuclear Power';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Outcome = {player?: string, step: string, part?: string, kind: string, amount?: number};
type Wire = {
  thisPlayer: {color: string, steel: number, titanium: number, steelValue: number, titaniumValue: number},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
  game: {parliament?: {enacted?: {resolution: string}, phase?: {outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/** The rail's value badge for `unit` — «one unit of this resource replaces N M€». */
const badge = (page: Page, unit: 'steel' | 'titanium') => page.locator(`.con-res__mcbadge[data-mc-badge="${unit}"] .con-valbadge__text`).first();
const badgeText = async (page: Page, unit: 'steel' | 'titanium'): Promise<string> => {
  const el = badge(page, unit);
  return await el.count() > 0 ? (await el.textContent() ?? '').trim() : '';
};

const composer = (page: Page) => page.locator('.con-composer--play');

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

test.describe(`Metal Research · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the rail badges turn 2 → 3 and 3 → 4 the moment the law stands; then the payment panel charges steel at 3 and the price stays printed', async ({page, request}) => {
    test.setTimeout(900_000);

    // ════════════════ PART 1 · THE SITTING — the value badges move with the law ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-metal-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);

    const before = await wireOf(request, playerId);
    expect([before.thisPlayer.steelValue, before.thisPlayer.titaniumValue], 'the base values before the enactment').toEqual([2, 3]);
    // ── ⓪ THE BADGES BEFORE: «2» on steel, «3» on titanium — the rail restates the model's live value.
    await expect.poll(() => badgeText(page, 'steel'), {timeout: 15_000, message: 'the steel badge reads the base 2'}).toBe('2');
    await expect.poll(() => badgeText(page, 'titanium'), {timeout: 15_000, message: 'the titanium badge reads the base 3'}).toBe('3');
    await shoot(page, '01-verdict-badges-2-3');

    // ── ① THE INSPECTION states the passive as its own block: what the law does while it stands.
    await openZoomViewer(page);
    const rules = page.locator('dialog.con-zoom[open] .con-zoom-sidecol');
    await expect(rules).toContainText(/на 1 M€ больше|1 M€ more/);
    await expect(rules).toContainText(/по 1 стали и 1 титану|1 steel and 1 titanium/);
    await shoot(page, '02-inspect-passive');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    // ── GATE 1: A on the verdict; red answers over the API. Everything after this turns by itself.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ② THE SEAT IS PAID ITS TWO PARTS: influence 2 → 2 steel AND 2 titanium, two records.
    await expect.poll(async () => {
      const wire = await wireOf(request, playerId);
      const outcomes = [...(wire.game.parliament?.phase?.outcomes ?? []), ...(wire.game.parliament?.lastPhase?.outcomes ?? [])];
      const mine = outcomes.filter((o) => o.player === before.thisPlayer.color && o.kind === 'stock');
      return mine.map((o) => `${o.step}:${o.amount}`).join(',');
    }, {timeout: 60_000, message: 'the seat\'s own steel and titanium are recorded, one record each'}).toBe('steel:2,titanium:2');

    // ── ③ THE FRAME OF THE ITERATION: the law stands and the badges read «3» / «4» — same screen, no reload, no press.
    await expect.poll(async () => {
      const wire = await wireOf(request, playerId);
      return `${wire.game.parliament?.enacted?.resolution}:${wire.thisPlayer.steelValue}/${wire.thisPlayer.titaniumValue}`;
    }, {timeout: 60_000, message: 'the server reads 3 / 4 the moment the law is enacted'}).toBe(`${METAL_ID}:3/4`);
    await expect.poll(() => badgeText(page, 'steel'), {timeout: 60_000, message: 'the steel badge moved 2 → 3 with the law'}).toBe('3');
    await expect.poll(() => badgeText(page, 'titanium'), {timeout: 60_000, message: 'the titanium badge moved 3 → 4 with the law'}).toBe('4');
    const mid = await wireOf(request, playerId);
    expect(mid.thisPlayer.steel - before.thisPlayer.steel, 'the supply grew by the payout, not by the value').toBe(2);
    expect(mid.thisPlayer.titanium - before.thisPlayer.titanium).toBe(2);
    await shoot(page, '03-badges-3-4-under-the-law');

    // …the sitting walks to its results on its own; nothing is stranded.
    await expect.poll(() => sittingStage(page), {timeout: 90_000, message: 'the walk reaches the results'}).toBe('results');
    await waitSittingAtRest(page, 60_000);
    await shoot(page, '04-results');
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);

    // ════════════════ PART 2 · THE PRICE — the law stands, steel pays at 3, the price is printed ════════════════
    const enacted = await bootFixtureSeats(page, request, 'parliament-metal-enacted');
    const viewer = enacted.playerId;
    const wire = await wireOf(request, viewer);
    expect([wire.thisPlayer.steelValue, wire.thisPlayer.titaniumValue], 'the SERVER reads 3 / 4 under the law').toEqual([3, 4]);
    const held = wire.cardsInHand?.find((c) => c.name === BUILDING_CARD);
    expect(held, 'the viewer holds Nuclear Power').toBeTruthy();
    expect(held?.calculatedCost, 'a value is not a discount: the printed 10 stands').toBe(10);
    await expect.poll(() => badgeText(page, 'steel'), {timeout: 30_000}).toBe('3');
    await expect.poll(() => badgeText(page, 'titanium'), {timeout: 30_000}).toBe('4');
    await shoot(page, '05-rail-badges-enacted');

    // ── ④ THE EFFECTS LIST names the law — Information → the effects zone → the explorer's Parliament strip.
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
    await expect(law).toHaveAttribute('data-resolution', METAL_ID);
    await expect(law.locator('.con-pfx__why b'), 'titled by the card').toHaveText(/Исследование металлов|Metal Research/i);
    await settle(page, {timeoutMs: 15_000, notifications: false});
    await shoot(page, '06-effects-strip');
    for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await expect(page.locator('.con-info, .con-efx')).toHaveCount(0, {timeout: 10_000});

    // ── ⑤ THE PAYMENT PANEL: the head reads the printed «10» with nothing saved; the steel row reads «×3».
    await openPlayComposer(page, BUILDING_CARD);
    const head = page.locator('.con-composer--play .con-pay__head');
    // No discount → no «base → final» pair in the head: the printed price is the only number, and nothing is «saved».
    await expect(head.locator('[data-pay-base]'), 'no base/final pair without a discount').toHaveCount(0);
    await expect(head.locator('.con-pay__price-value')).toHaveText('10');
    await expect(head.locator('[data-pay-saved]'), 'a value saves nothing off the price').toHaveCount(0);
    const steelRow = page.locator('.con-composer--play .con-payrow[data-pay-unit="steel"]');
    if (await steelRow.count() === 0) {
      // The rows live in the expanded editor on this composition: LT opens it.
      expect(await pressUntil(page, 'Comma', async () => await steelRow.count() > 0, {tries: 3, settleMs: 1100}), 'LT must open the payment editor').toBeTruthy();
    }
    await expect(steelRow, 'the steel source row stands').toHaveCount(1);
    await expect(steelRow.locator('.con-payrow__rate'), 'ONE steel pays 3 M€ under the law').toHaveText('×3');
    await shoot(page, '07-play-steel-rate-3');

    // Back out without playing: the journey is the value and where it is read, not the play.
    for (let i = 0; i < 8 && await page.locator('.con-composer__fxlayer, .con-composer--play, .con-hand').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
