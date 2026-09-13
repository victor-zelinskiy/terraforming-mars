import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, crumbText, fetchPlayerModel, focusCard, openActionFocus, openCardActions, press, pressUntil, settle,
  waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * THE EFFECT FORECAST — what the TABLE answers to a card play / a card action
 * (docs/claude/console/effect-forecast.md):
 *
 *   the compact «Сработает» row inside the composer's result cluster (chips
 *   only — own mint gains, the «?» of a question, an opponent's colour bar,
 *   «+N» past the cap) · the discount tail in the payment head («ЦЕНА 8 → 6»
 *   + «−2») · the R3 «Эффекты» LAYER re-hosting the effects explorer over
 *   the parked composer (eight groups, the five-question dossier, A → the
 *   detail stage, B / R3 back with the payment and the cursor untouched) ·
 *   the «↳» reactions drawn INSIDE the «ИЛИ» option cards · the action
 *   screen's fourth formula side · and the NO-NEW-SCROLL guard on all three
 *   profiles.
 *
 * STATE IS DECLARED (the `effect-forecast` fixture): a 2p table where the
 * first seat (blue, Manutech) holds Carbon Nanosystems, Olympus Conference
 * with one science, Rover Construction, Earth Catapult, Decomposers, Viral
 * Enhancers, Meat Industry and Livestock, and red holds Pharmacy Union — the
 * FOREIGN reactor. Every scenario below is one press away from the board
 * home.
 *
 * Also the screenshot source (screenshots/effect-forecast/<preset>/).
 */

const OUT_ROOT = path.resolve('screenshots', 'effect-forecast');

type Preset = {
  id: string;
  viewport: {width: number, height: number};
  profileQuery: string;
  /** The full journey runs once (1080); the others sweep fit + parity. */
  journey: boolean;
};

const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto', journey: true},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv', journey: false},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld', journey: false},
];

/** The science play: Carbon Nanosystems' graphene (exact) + Olympus
 *  Conference's question + Earth Catapult's −2. */
const SCIENCE_CARD = 'Geological Survey';
/** The microbe play: four reactions incl. red's Pharmacy Union (two red chips). */
const MICROBE_CARD = 'Nitrite Reducing Bacteria';
/** The «ИЛИ» play: Manutech reacts to whichever production branch. */
const OR_CARD = 'Artificial Photosynthesis';
/** No reaction at all — only the discount (R3 without a row). */
const PLAIN_CARD = 'Security Fleet';
/** The action whose animal Meat Industry pays for. */
const ACTION_CARD = 'Livestock';

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const composer = (page: Page) => page.locator('.con-composer--play');
const forecastRow = (page: Page) => page.locator('.con-composer--play [data-forecast-row]');
const layer = (page: Page) => page.locator('.con-composer__fxlayer');
const detailStage = (page: Page) => page.locator('.con-composer__fxlayer .con-efx__stage');
const crumbStage = (page: Page) => page.locator('.con-hand .con-wshead__step');

/** A container proves «no scroll»: its content fits its own box. */
async function expectFits(page: Page, selector: string, label: string): Promise<void> {
  const verdict = await page.locator(selector).first().evaluate((el) => ({
    sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth,
  }));
  expect(verdict.sh, `${label}: content height ${verdict.sh} must fit ${verdict.ch}`)
    .toBeLessThanOrEqual(verdict.ch + 2);
  expect(verdict.sw, `${label}: content width ${verdict.sw} must fit ${verdict.cw}`)
    .toBeLessThanOrEqual(verdict.cw + 2);
}

/** Open the hand workspace and descend into `card`'s play composer. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  // The composer is content-complete once its commit rail has decided.
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/** Leave the composer and the hand — back to the board home. */
async function closeToBoard(page: Page): Promise<void> {
  expect(await pressUntil(page, 'Escape', async () => await composer(page).count() === 0, {tries: 4, settleMs: 900}),
    'B must fold the composer').toBeTruthy();
  expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 900}),
    'B must leave the hand').toBeTruthy();
  await settle(page);
}

/** The Carbon Nanosystems card in the viewer's live tableau — SERVER truth. */
async function grapheneOnCarbonNanosystems(request: APIRequestContext, playerId: string): Promise<number> {
  const model = await fetchPlayerModel(request, playerId);
  const me = model.thisPlayer as {tableau?: Array<{name: string, resources?: number}>} | undefined;
  return me?.tableau?.find((c) => c.name === 'Carbon Nanosystems')?.resources ?? -1;
}

/** Answer the effect decisions a play raises (Olympus Conference's question)
 *  with their FIRST option until the board home stands. */
async function finishPlay(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    if (await page.locator('.con-decision__action--focused').count() > 0) {
      await press(page, 'Enter', 900);
      continue;
    }
    if (await page.locator('.con-hand, .con-composer--play, .con-decision').count() === 0) {
      break;
    }
    await settle(page, {timeoutMs: 6_000});
  }
  await waitForBoardHome(page, 30);
}

for (const preset of PRESETS) {
  test.describe(`effect forecast · ${preset.id}`, () => {
    test.use({
      viewport: preset.viewport,
      deviceScaleFactor: 1,
      screen: preset.viewport,
    });

    test('«Сработает» row · discount tail · R3 layer · dossier · the no-scroll guard', async ({page, request}) => {
      test.setTimeout(560_000);

      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      const overflowWarns: Array<string> = [];
      page.on('console', (msg) => {
        if (msg.text().includes('[console-overflow]')) {
          overflowWarns.push(msg.text());
        }
      });

      // `conOverflow=1` arms the root overflow guard in the built client, so
      // a scroll the layer introduced would be logged, not merely clipped.
      const playerId = await bootFixture(page, request, 'effect-forecast', {query: `${preset.profileQuery}&conOverflow=1`});

      // ── 1. THE SCIENCE PLAY: the row, the badge, the discount tail ──
      await openPlayComposer(page, SCIENCE_CARD);
      const row = forecastRow(page);
      await expect(row, 'the «Сработает» unit stands in the result cluster').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="own"]'), 'Carbon Nanosystems\' graphene is a guaranteed own chip').toHaveCount(1);
      await expect(row.locator('[data-forecast-chip="asks"] .con-forecast__ask'), 'Olympus Conference asks — the «?» badge').toHaveCount(1);
      await expect(row.locator('.gp-glyph'), 'the row carries the R3 key').toHaveCount(1);
      // The payment head: «ЦЕНА 8 → 6» + «−2» (Earth Catapult) — same head height.
      const head = page.locator('.con-composer--play .con-pay__head');
      await expect(head.locator('[data-pay-base]')).toHaveText('8');
      await expect(head.locator('.con-pay__price-value')).toHaveText('6');
      await expect(head.locator('[data-pay-saved]')).toHaveText('−2');
      const headBox = await head.boundingBox();
      // The row is NOT a focus stop — the cursor stands on the commit rail.
      await expect(page.locator('.con-composer__cta--focused')).toHaveCount(1);
      await expectFits(page, '.con-composer--play .con-scroll-area__viewport', 'the work column (science play)');
      await shoot(page, preset, '1-row-and-discount');

      // ── 2. R3 → THE LAYER: the composer parks in place, the crumb gains
      // «· ЭФФЕКТЫ», the groups stand in their fixed order. ──
      expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100}),
        'R3 must open the «Эффекты» layer').toBeTruthy();
      await expect(crumbStage(page)).toContainText(/эффекты/i);
      const groups = layer(page).locator('[data-forecast-group]');
      const groupIds = await groups.evaluateAll((els) => els.map((e) => e.getAttribute('data-forecast-group')));
      expect(groupIds, 'the science play fills «Вы получите», «Вас спросят» and «Скидки и оплата»').toEqual(
        expect.arrayContaining(['receive', 'asked', 'discounts']));
      // The order is the fixed one — receive before asked before discounts.
      expect(groupIds.indexOf('receive')).toBeLessThan(groupIds.indexOf('asked'));
      expect(groupIds.indexOf('asked')).toBeLessThan(groupIds.indexOf('discounts'));
      await expect(layer(page).locator('.con-efx__tile--focused'), 'the layer opens with a focused tile').toHaveCount(1);
      await expect(layer(page).locator('.con-efx__detail [data-forecast-questions]'), 'the dossier answers the five questions').toHaveCount(1);
      await expectFits(page, '.con-composer__fxpanel', 'the layer panel');
      await shoot(page, preset, '2-layer-groups');

      if (!preset.journey) {
        // The fit sweep is this preset's whole job; the journey runs at 1080.
        await press(page, 'KeyV', 900);
        await expect(layer(page)).toHaveCount(0, {timeout: 10_000});
        await closeToBoard(page);
        for (const card of [MICROBE_CARD, OR_CARD, PLAIN_CARD]) {
          await openPlayComposer(page, card);
          await expectFits(page, '.con-composer--play .con-scroll-area__viewport', `the work column (${card})`);
          await shoot(page, preset, `3-fit-${card.toLowerCase().replace(/\s+/g, '-')}`);
          await closeToBoard(page);
        }
        expect(overflowWarns, `no [console-overflow] warn; saw: ${overflowWarns.join(' | ')}`).toEqual([]);
        expect(pageErrors, `no page errors; saw: ${pageErrors.join(' | ')}`).toEqual([]);
        return;
      }

      // ── 3. A → THE DETAIL STAGE: «ЧТО ПРОИЗОЙДЁТ» first, the crumb gains
      // the source card; B folds one level; R3 closes the whole layer with
      // the payment and the cursor exactly as they were. ──
      expect(await pressUntil(page, 'Enter', async () => await detailStage(page).count() > 0, {tries: 3, settleMs: 1000}),
        'A must descend into the item\'s dossier').toBeTruthy();
      await expect(detailStage(page).locator('[data-forecast-questions]')).toHaveCount(1);
      const stageCrumb = await crumbText(page);
      expect(stageCrumb.toLowerCase(), 'the crumb names the source at the detail stage').toMatch(/эффекты/);
      expect(stageCrumb.split('·').length, 'the tail gained a third segment').toBeGreaterThanOrEqual(3);
      await shoot(page, preset, '3-detail-stage');
      await press(page, 'Escape', 900);
      await expect(detailStage(page)).toHaveCount(0, {timeout: 10_000});
      await expect(layer(page), 'B folds one level — the layer stays').toHaveCount(1);
      await press(page, 'KeyV', 900);
      await expect(layer(page)).toHaveCount(0, {timeout: 10_000});
      await expect(crumbStage(page)).not.toContainText(/эффекты/i);
      // Untouched underneath: the discount tail and the commit cursor.
      await expect(head.locator('[data-pay-base]')).toHaveText('8');
      await expect(page.locator('.con-composer__cta--focused')).toHaveCount(1);
      const headBoxAfter = await head.boundingBox();
      expect(headBoxAfter?.height, 'the payment head kept its height through the layer').toBe(headBox?.height);

      // ── 4. A → THE PLAY, then the SERVER's own truth: the graphene landed. ──
      expect(await grapheneOnCarbonNanosystems(request, playerId)).toBe(0);
      await press(page, 'Enter', 1500);
      await finishPlay(page);
      expect(await grapheneOnCarbonNanosystems(request, playerId), 'Carbon Nanosystems gained its graphene').toBe(1);

      // ── 5. THE OPPONENT CHIP: red's Pharmacy Union on a microbe tag — the
      // disease and the −4 M€ wear red's colour bar, AFTER the own chips and
      // the question (four chips: the cap's edge, nothing folded); the
      // layer's «Получат другие» names the owner. ──
      await openPlayComposer(page, MICROBE_CARD);
      const microbeRow = forecastRow(page);
      await expect(microbeRow).toHaveCount(1);
      await expect(microbeRow.locator('[data-forecast-chip]'), 'four reactions — the cap\'s edge').toHaveCount(4);
      await expect(microbeRow.locator('[data-forecast-chip="other"] .con-forecast__owner-bar.player_bg_color_red'),
        'red\'s reactions wear red\'s colour bar').toHaveCount(2);
      await expect(microbeRow.locator('[data-forecast-chip="more"]'), 'nothing folds at exactly four').toHaveCount(0);
      const kinds = await microbeRow.locator('[data-forecast-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-forecast-chip')));
      expect(kinds, 'own → asks → others').toEqual(['own', 'asks', 'other', 'other']);
      await expectFits(page, '.con-composer--play .con-scroll-area__viewport', 'the work column (microbe play)');
      await shoot(page, preset, '5-opponent-chip');
      expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
      await expect(layer(page).locator('[data-forecast-group="others"]')).toHaveCount(1);
      await expect(layer(page).locator('.con-efx__tile--fx-others .con-efx__tile-owner'), 'the foreign tile names its owner').not.toHaveCount(0);
      await shoot(page, preset, '6-layer-others');
      await press(page, 'KeyV', 900);
      await expect(layer(page)).toHaveCount(0, {timeout: 10_000});
      await closeToBoard(page);

      // ── 6. THE «ИЛИ» PLAY: Manutech's reactions ride INSIDE the option
      // cards («↳»), never the row; the layer's «Зависит от вашего выбора». ──
      await openPlayComposer(page, OR_CARD);
      await expect(page.locator('.con-composer__variant [data-forecast-vchip]'), 'each branch carries its reaction').toHaveCount(2);
      // The card's science tag still fires Carbon Nanosystems + Olympus
      // Conference — the row holds exactly those two; Manutech's branch-tied
      // reactions never reach it.
      await expect(forecastRow(page).locator('[data-forecast-chip]'), 'branch-tied reactions never reach the row').toHaveCount(2);
      await expectFits(page, '.con-composer--play .con-scroll-area__viewport', 'the work column («ИЛИ» play)');
      await shoot(page, preset, '7-or-reactions');
      expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
      await expect(layer(page).locator('[data-forecast-group="depends"]')).toHaveCount(1);
      await press(page, 'KeyV', 900);
      await expect(layer(page)).toHaveCount(0, {timeout: 10_000});
      await closeToBoard(page);

      // ── 7. NO REACTION AT ALL: no row — but the discount keeps the layer. ──
      await openPlayComposer(page, PLAIN_CARD);
      await expect(forecastRow(page), 'an empty table draws no row').toHaveCount(0);
      await expect(page.locator('.con-composer--play .con-pay__head [data-pay-saved]')).toHaveText('−2');
      expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 1100}),
        'a discount-only forecast still opens the layer').toBeTruthy();
      await expect(layer(page).locator('[data-forecast-group]')).toHaveCount(1);
      await expect(layer(page).locator('[data-forecast-group="discounts"]')).toHaveCount(1);
      await press(page, 'KeyV', 900);
      await expect(layer(page)).toHaveCount(0, {timeout: 10_000});
      await expectFits(page, '.con-composer--play .con-scroll-area__viewport', 'the work column (plain play)');
      await closeToBoard(page);

      // ── 8. THE ACTION SCREEN: the formula's fourth side, the same layer. ──
      await openCardActions(page);
      const focusedAction = () => page.evaluate(() =>
        document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      expect(await walkFocusUntil(page, async () => await focusedAction() === ACTION_CARD, focusedAction, 30),
        `never focused the «${ACTION_CARD}» action`).toBeTruthy();
      await openActionFocus(page);
      const stage = page.locator('.con-composer--stage');
      await expect(stage.locator('.con-composer__hero-side--forecast [data-forecast-chip="own"]'),
        'Meat Industry\'s M€ stands as the formula\'s fourth side').toHaveCount(1);
      await shoot(page, preset, '8-action-row');
      expect(await pressUntil(page, 'KeyV', async () => await stage.locator('.con-composer__fxlayer').count() > 0, {tries: 3, settleMs: 1100}),
        'R3 must open the layer on the action screen').toBeTruthy();
      await expect(page.locator('.con-cardactions .con-wshead__step')).toContainText(/эффекты/i);
      await expect(stage.locator('[data-forecast-group="receive"]')).toHaveCount(1);
      await shoot(page, preset, '9-action-layer');
      await press(page, 'Escape', 900);
      await expect(stage.locator('.con-composer__fxlayer'), 'B at the browse level closes the layer').toHaveCount(0, {timeout: 10_000});
      await expect(stage, 'the setup stage survived the layer').toHaveCount(1);
      await expect(page.locator('.con-cardactions .con-wshead__step')).not.toContainText(/эффекты/i);

      expect(overflowWarns, `no [console-overflow] warn; saw: ${overflowWarns.join(' | ')}`).toEqual([]);
      expect(pageErrors, `no page errors; saw: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  });
}

// ── REDUCED MOTION: the whole vertical still lands (microtask done). ──
test.describe('effect forecast · reduced motion', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
  });

  test('row → layer → detail → back, snapping', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootFixture(page, request, 'effect-forecast', {query: '&consoleProfile=auto'});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await openPlayComposer(page, SCIENCE_CARD);
    await expect(forecastRow(page)).toHaveCount(1);
    expect(await pressUntil(page, 'KeyV', async () => await layer(page).count() > 0, {tries: 3, settleMs: 700}),
      'the layer lands under reduced motion').toBeTruthy();
    expect(await pressUntil(page, 'Enter', async () => await detailStage(page).count() > 0, {tries: 3, settleMs: 700}),
      'the dossier lands under reduced motion').toBeTruthy();
    await press(page, 'Escape', 700);
    await expect(detailStage(page)).toHaveCount(0, {timeout: 10_000});
    await press(page, 'Escape', 700);
    await expect(layer(page), 'B at the browse level closes the layer').toHaveCount(0, {timeout: 10_000});
    await expect(composer(page), 'the composer is back and live').toHaveCount(1);
    await expect(page.locator('.con-composer__cta--focused')).toHaveCount(1);
  });
});
