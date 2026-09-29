import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle,
  waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * TR09 — EVA MECHS («Мехи ВКД»), the first Turmoil Redux PROJECT card and the
 * card that introduces the `Mech` card resource + the `mechs` payment unit
 * (docs/TURMOIL_REDUX_EVA_MECHS.md). ONE spec for the ONE new mechanic; the
 * next 69 cards ride the paths their neighbours already proved.
 *
 * STATE IS DECLARED (the `eva-mechs` fixture): a 2p table where blue holds
 * EVA Mechs with TWO mechs, exactly ONE energy, 3 M€, no titanium, and
 * Trans-Neptune Probe (Science + Space, cost 6, no requirement, no follow-up)
 * in hand — SHORT of the probe without a mech.
 *
 *  1. ДЕЙСТВИЯ КАРТ → EVA Mechs → the composer states «−1 энергия» / «+1 мех
 *     на этой карте», the hero's capsule reads «2» → A → the plain reward
 *     concludes the workspace to the board; the SERVER agrees (3 mechs,
 *     0 energy) and the left rail's ДОП. РЕСУРСЫ chip reads 3 with the «5»
 *     coin (only while the card stands in the tableau).
 *  2. Hand → Trans-Neptune Probe → the payment panel offers the «Мехи» lane
 *     at ×5 with the mech sprite, the opening mix closed the deficit with
 *     ONE mech + 1 M€ (exact, no overpay), the lone alternative wears its
 *     inline pills and advertises no editor → A → the SERVER agrees: the
 *     probe is in the tableau, the card lost exactly the mech it spent, the
 *     M€ add up, the rail chip reads 2 again.
 *
 * Every wait is a state-wait (settle / pressUntil / locator expectations);
 * every witness is server truth or a driver witness. Screenshots →
 * `screenshots/eva-mechs/`.
 */

const OUT = path.resolve('screenshots', 'eva-mechs');
const CARD = 'EVA Mechs';
const SPACE_CARD = 'Trans-Neptune Probe';

type Wire = Record<string, any>;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** SERVER truth for the viewer: the mechs ON the card, the stock, the hand and the tableau. */
async function evaState(request: APIRequestContext, playerId: string): Promise<{
  mechs: number, energy: number, megaCredits: number, hand: Array<string>, tableau: Array<string>,
}> {
  const model = await fetchPlayerModel(request, playerId) as Wire;
  const me = (model.thisPlayer ?? {}) as Wire;
  const tableau = ((me.tableau ?? []) as Array<Wire>);
  return {
    mechs: Number(tableau.find((c) => c.name === CARD)?.resources ?? -1),
    energy: Number(me.energy ?? -1),
    // The wire field is `megacredits` (PublicPlayerModel) — not the server's `megaCredits`.
    megaCredits: Number(me.megacredits ?? -1),
    hand: ((model.cardsInHand ?? []) as Array<Wire>).map((c) => String(c.name)),
    tableau: tableau.map((c) => String(c.name)),
  };
}

/** The left rail's ДОП. РЕСУРСЫ cell of the mech chip — the «5» coin marks it. */
const mechAuxCell = (page: Page) => page.locator('.con-res-aux__cell:has([data-mc-badge="mech"])');

/** Open the hand workspace and descend into `card`'s play composer (the effect-forecast driver). */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  const composer = page.locator('.con-composer--play');
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  // The composer is content-complete once its commit rail has decided.
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

test.describe('EVA Mechs (TR09) · fhd', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the action stores a mech on the card; the mech pays for a Space card at 5', async ({page, request}) => {
    test.setTimeout(360_000);
    const pageErrors: Array<string> = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    const playerId = await bootFixture(page, request, 'eva-mechs', {query: '&consoleProfile=auto'});
    const atBoot = await evaState(request, playerId);
    expect(atBoot, 'the fixture arrangement').toMatchObject({mechs: 2, energy: 1, megaCredits: 3});
    expect(atBoot.hand).toContain(SPACE_CARD);

    // ── The rail already reads the tender: the mech chip with its «5» coin. ──
    await expect(mechAuxCell(page), 'the ДОП. РЕСУРСЫ mech chip stands with the M€ coin').toHaveCount(1, {timeout: 15_000});
    await expect(mechAuxCell(page).locator('.con-res-aux__value')).toHaveText('2');
    await expect(mechAuxCell(page).locator('[data-mc-badge="mech"] .con-valbadge__text'), 'a mech pays 5').toHaveText('5');
    await expect(mechAuxCell(page).locator('[data-mc-badge="mech"]'), 'the aria names the M€ meaning').toHaveAttribute('aria-label', /M€/);

    // ── 1. THE ACTION: ДЕЙСТВИЯ КАРТ → EVA Mechs → the setup stage. ──
    await openCardActions(page);
    const focusedAction = () => page.evaluate(() =>
      document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
    expect(await walkFocusUntil(page, async () => await focusedAction() === CARD, focusedAction, 30),
      `never focused the «${CARD}» action`).toBeTruthy();
    await openActionFocus(page);
    const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
    await expect(page.locator('.con-composer__cta--ready'), 'the preview landed and the CTA is armed').toBeVisible({timeout: 20_000});
    await settle(page);
    // The composer states the exchange: 1 energy leaves the stock, 1 mech lands ON THIS CARD.
    const cost = stage.locator('.action-effect-chip--cost');
    await expect(cost, 'one cost chip — the energy').toHaveCount(1);
    await expect(cost.locator('.action-effect-chip__icon')).toHaveClass(/resource_icon--energy/);
    await expect(cost.locator('.action-effect-chip__cur')).toHaveText('1');
    await expect(cost.locator('.action-effect-chip__res')).toHaveText('0');
    const gain = stage.locator('.action-effect-chip--gain');
    await expect(gain, 'one gain chip — the mech').toHaveCount(1);
    await expect(gain.locator('.action-effect-chip__icon'), 'the mech sprite, never an empty box').toHaveClass(/card-resource-mech/);
    await expect(gain.locator('.action-effect-chip__cur')).toHaveText('2');
    await expect(gain.locator('.action-effect-chip__res')).toHaveText('3');
    await expect(gain.locator('.action-effect-chip__note'), 'the gain is «on this card»').toContainText(/на этой карте/i);
    // The hero card is fed the LIVE model: its capsule reads the two stored mechs.
    await expect(stage.locator('.pcard__res-count').first(), 'the hero capsule reads the stored mechs').toHaveText('2');
    await shoot(page, '01-action-setup');

    // ── COMMIT: a plain reward — the flow leaves for the board, the server agrees. ──
    await press(page, 'Enter', 800);
    await expect(page.locator('.con-cardactions'), 'a finished reward flow LEAVES (never a fold to browse)').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 30_000});
    await waitForBoardHome(page, 30);
    const afterAction = await evaState(request, playerId);
    expect(afterAction.mechs, 'the mech landed ON the card').toBe(3);
    expect(afterAction.energy, 'the energy was spent').toBe(0);
    expect(afterAction.megaCredits, 'nothing else moved').toBe(3);
    await expect(mechAuxCell(page).locator('.con-res-aux__value'), 'the rail chip ticked to 3').toHaveText('3', {timeout: 15_000});
    await shoot(page, '02-after-action');

    // ── 2. THE PLAY: Trans-Neptune Probe — the mech lane pays the deficit. ──
    await openPlayComposer(page, SPACE_CARD);
    const head = page.locator('.con-composer--play .con-pay__head');
    await expect(head.locator('.con-pay__price-value')).toHaveText('6');
    const row = page.locator('.con-composer--play .con-payrow[data-pay-unit="mechs"]');
    await expect(row, 'the mech lane stands on a Space card').toHaveCount(1);
    await expect(row.locator('.con-payrow__name'), 'the lane names the RESOURCE').toHaveText(/мехи/i);
    await expect(row.locator('.con-payrow__rate'), 'a mech pays 5').toHaveText('×5');
    await expect(row.locator('.con-payrow__icon'), 'the mech sprite on the row').toHaveClass(/card-resource-mech/);
    // The opening mix: 3 M€ cannot pay 6, so ONE mech (5) + 1 M€ = 6 exactly —
    // never the second mech (an avoidable +4).
    await expect(row.locator('.con-payrow__used'), 'one mech is spent by default').toHaveText('1');
    await expect(row.locator('.con-payrow__before')).toHaveText('3');
    await expect(row.locator('.con-payrow__after')).toHaveText('2');
    await expect(page.locator('.con-composer--play .con-payrow[data-pay-unit="megacredits"] .con-payrow__used')).toHaveText('1');
    await expect(page.locator('.con-composer--play .con-paystatus'), 'exact — no overpay by default').toHaveClass(/con-paystatus--exact/);
    // The lone alternative IS the editor: pills on the row, no LT entry advertised.
    await expect(row.locator('.con-payrow__pills')).toHaveCount(1);
    await expect(page.locator('.con-composer--play .con-pay__hint')).toHaveCount(0);
    await expect(page.locator('.con-composer__cta--ready'), 'affordable — the CTA is armed').toBeVisible();
    await shoot(page, '03-payment-mech-lane');

    // RB dials the second mech in: the verdict becomes an honest «+4», the M€ lane drops to 0.
    await press(page, 'KeyE', 500);
    await expect(row.locator('.con-payrow__used')).toHaveText('2');
    await expect(page.locator('.con-composer--play .con-payrow[data-pay-unit="megacredits"] .con-payrow__used')).toHaveText('0');
    await expect(page.locator('.con-composer--play .con-paystatus'), 'two mechs on a 6 M€ card overpay by 4 — stated, not hidden').toHaveClass(/con-paystatus--overpay/);
    await shoot(page, '04-payment-overpay');
    // …and LB back to the exact mix.
    await press(page, 'KeyQ', 500);
    await expect(row.locator('.con-payrow__used')).toHaveText('1');
    await expect(page.locator('.con-composer--play .con-paystatus')).toHaveClass(/con-paystatus--exact/);

    // ── COMMIT the play; the SERVER's own truth. ──
    const beforePlay = await evaState(request, playerId);
    expect(beforePlay).toMatchObject({mechs: 3, megaCredits: 3});
    await press(page, 'Enter', 1500);
    // No decision follows the probe (no effect, no target): the workspace leaves and the board home stands.
    await expect(page.locator('.con-composer--play'), 'the play composer is gone').toHaveCount(0, {timeout: 40_000});
    await settle(page, {timeoutMs: 30_000});
    await waitForBoardHome(page, 30);
    const afterPlay = await evaState(request, playerId);
    expect(afterPlay.tableau, 'the probe was played').toContain(SPACE_CARD);
    expect(afterPlay.hand, 'and left the hand').not.toContain(SPACE_CARD);
    expect(afterPlay.mechs, 'exactly the ONE mech the mix spent left the card').toBe(2);
    expect(afterPlay.megaCredits, '3 − 1 M€ = 2').toBe(2);
    await expect(mechAuxCell(page).locator('.con-res-aux__value'), 'the rail chip reads the spent mech').toHaveText('2', {timeout: 15_000});
    await shoot(page, '05-after-play');

    expect(pageErrors, `no page errors; saw: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
