import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * HAND DELIVERY probe — the starting-cards delivery cinematic
 * (handDeliveryDirector.ts).
 *
 * The bought project cards are already in `cardsInHand` from the ceremony's
 * first frame — the payment only deducts M€. So the delivery is a CLIENT
 * beat that must fire ONLY at the project-payment step:
 *  - during the ceremony the bought cards are WITHHELD from the dock
 *    (counter 0, `--held` cards laid out but hidden) — never shown in the
 *    hand before payment;
 *  - the payment element shows them FACE UP (a compact grid) so the player
 *    sees exactly which cards they are buying;
 *  - pressing PAY flies those face-up cards into the dock (face → back),
 *    materializing them one-by-one as the counter ticks 0 → N;
 *  - it fires at the PAY beat ONLY (not on the summary submit, corp play, or
 *    a prelude) and reduced motion arrives instantly with no stuck hold.
 */

const OUT = path.resolve('screenshots', 'hand-delivery');

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'DeliverTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: [], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: [], requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 900): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Walk the wizard to the summary and buy at least one project WITHOUT the
 *  final submit — the caller presses Enter to submit + enter the ceremony. */
async function toSummary(page: Page, request: any, profileQuery = ''): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok()).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  // ADAPTIVE wizard walk — the layouts differ by profile / reduced-motion, so
  // a fixed key sequence drifts. Each round PICKS the focused card, MOVES on,
  // and TRIES to continue (RT advances only when a step is complete). Stops at
  // the launch CTA «НАЧАТЬ ПАРТИЮ» (never pressing A on the summary).
  const launch = page.getByText('НАЧАТЬ ПАРТИЮ').first();
  for (let round = 0; round < 20 && await launch.count() === 0; round++) {
    await key(page, 'Enter', 700);
    if (await launch.count() > 0) {
      break;
    }
    await key(page, 'ArrowRight', 500);
    await key(page, 'Period', 1200);
  }
  await expect(launch, 'reached the start summary').toBeVisible({timeout: 4000});
  // GUARANTEE at least one bought project (so the delivery has something to
  // fly). The adaptive walk can reach the summary with a zero buy on some
  // layouts — step BACK to the projects (LB) and buy two explicitly.
  const noBuy = page.getByText('Вы не покупаете ни одной проектной карты').first();
  if (await noBuy.count() > 0) {
    await key(page, 'KeyQ', 900); // LB → previous step (the projects buy)
    await key(page, 'Enter', 700); // buy the focused (first) project
    await key(page, 'ArrowRight', 400);
    await key(page, 'Enter', 700); // and a second, for a fuller flight
    await key(page, 'Period', 1300); // → back to the summary
    await expect(launch, 'back on the summary after buying').toBeVisible({timeout: 4000});
  }
  await expect(page.locator('.con-handdock')).toHaveCount(1);
}

/** From the summary: submit (Enter) → ceremony, then advance the deferred
 *  corporation play until the PAYMENT beat is on screen — WITHOUT pressing
 *  the pay itself (that is the delivery trigger the caller fires). */
async function toPayStep(page: Page): Promise<void> {
  await key(page, 'Enter', 1600); // submit the summary → the ceremony
  const payCard = page.locator('.con-start__pay-card');
  // Play the corp (a hero flight; Enter is swallowed while it runs) until the
  // pay beat appears. The loop re-checks BEFORE each press, so it never
  // presses Enter on the pay card (which would fire the delivery early).
  for (let i = 0; i < 10 && await payCard.count() === 0; i++) {
    await key(page, 'Enter', 1600);
  }
  await expect(payCard, 'reached the project-payment beat').toBeVisible({timeout: 8000});
}

test.describe('hand delivery · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('delivery fires at the PAY beat: face-up cards fly in, withheld until they land', async ({page, request}) => {
    test.setTimeout(240_000);
    await toSummary(page, request);

    // Summary: NO placeholder ghost, dock empty (bought cards not yet paid).
    await expect(page.locator('.con-handdock__ghost')).toHaveCount(0);
    await shoot(page, '01-summary-empty-dock');

    await toPayStep(page);

    // The payment element shows the bought cards FACE UP (the compact grid).
    const faceUp = page.locator('.con-start__pay-proxy[data-pay-card]');
    const boughtCount = await faceUp.count();
    expect(boughtCount, 'bought cards shown face-up in the payment grid').toBeGreaterThan(0);
    // The cards are HELD out of the dock — never in hand before payment.
    const totalBeforePay = (await page.locator('.con-handdock__num--total').first().textContent())?.trim();
    expect(totalBeforePay, 'dock counter withheld before payment').toBe('0');
    expect(await page.locator('.con-handdock__card--held').count(), 'cards laid out but held').toBeGreaterThan(0);
    // No flight yet — the delivery fires ONLY on the pay press.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await shoot(page, '02-pay-step-faceup');

    // PAY → the face-up cards fly from the grid into the dock.
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy').first()).toBeVisible({timeout: 3000});
    // Face → back flip proxies (each carries a face).
    expect(await page.locator('.con-handdelivery-layer .con-deal-proxy__face').count()).toBeGreaterThan(0);
    // Still withheld while flying — the counter has not jumped ahead.
    const totalDuringFlight = (await page.locator('.con-handdock__num--total').first().textContent())?.trim();
    expect(totalDuringFlight, 'counter withheld during flight').toBe('0');
    await shoot(page, '03-mid-delivery');

    // Settle: proxies gone, cards materialized, counter caught up to N (≥1).
    await page.waitForTimeout(3000);
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-handdock__card--held')).toHaveCount(0);
    const delivered = await page.locator('.con-handdock__card').count();
    expect(delivered, 'cards materialized in the dock').toBeGreaterThanOrEqual(boughtCount);
    const totalAfter = (await page.locator('.con-handdock__num--total').first().textContent())?.trim();
    expect(totalAfter, 'counter reached the delivered total').toBe(String(delivered));
    await shoot(page, '04-delivered');
  });
});

test.describe('hand delivery · reduced motion', () => {
  test.use({
    viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080}, reducedMotion: 'reduce',
  });

  test('no proxies — the bought cards still arrive on pay (instant, connected)', async ({page, request}) => {
    test.setTimeout(240_000);
    await toSummary(page, request);
    await toPayStep(page);
    // Held before the pay press even under reduced motion.
    expect(await page.locator('.con-handdock__card--held').count()).toBeGreaterThan(0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    // No flight; the cards are simply there, no stuck hold.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-handdock__card--held')).toHaveCount(0);
    expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    await shoot(page, '05-reduced-delivered');
  });
});

test.describe('hand delivery · tv 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('tv profile: the delivery plays at the pay beat and settles', async ({page, request}) => {
    test.setTimeout(240_000);
    await toSummary(page, request, '&consoleProfile=tv');
    await toPayStep(page);
    await expect(page.locator('.con-start__pay-proxy[data-pay-card]').first()).toBeVisible({timeout: 4000});
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy').first()).toBeVisible({timeout: 3000});
    await shoot(page, '06-tv-mid-delivery');
    await page.waitForTimeout(3000);
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    await shoot(page, '07-tv-delivered');
  });
});
