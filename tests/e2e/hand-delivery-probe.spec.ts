import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards,
  fillPicks,
  openConsole,
  pickCards,
  playQueueCard,
  submitSummary,
  waitQueueIdle,
  walkToSummary,
} from './consoleStart';

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
    startingCorporations: 1, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: ['Ecoline'], bannedCards: [], includedCards: [], customColoniesList: [],
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
async function toSummary(page: Page, request: APIRequestContext, profileQuery = ''): Promise<string> {
  const playerId = await createGameWithCards(request, [], {config: newGameConfig()});
  await openConsole(page, playerId, profileQuery);
  let corporation = '';
  await walkToSummary(page, {
    onStep: async (stepPage, kind) => {
      if (kind === 'corporation') {
        const picked = await pickCards(stepPage, ['Ecoline']);
        expect(picked, 'the controlled corporation must be offered').toContain('Ecoline');
        corporation = 'Ecoline';
      } else if (kind === 'prelude' || kind === 'project') {
        // Two preludes satisfy the setup; two projects guarantee a meaningful
        // multi-card delivery while keeping the chosen names irrelevant.
        await fillPicks(stepPage, 2);
      }
    },
  });
  await expect(page.locator('.con-start > .con-start__frame .con-start__summary'),
    'reached the start summary').toBeVisible({timeout: 10_000});
  await expect(page.locator('.con-handdock')).toHaveCount(1);
  expect(corporation, 'a calm corporation was selected').not.toBe('');
  return corporation;
}

/** From the summary: submit (Enter) → ceremony, then advance the deferred
 *  corporation play until the PAYMENT beat is on screen — WITHOUT pressing
 *  the pay itself (that is the delivery trigger the caller fires). */
async function toPayStep(page: Page, corporation: string): Promise<void> {
  await submitSummary(page);
  const payCard = page.locator('.con-start__buy');
  // The buy block is persistent but disabled beside the corporation. Resolve
  // the named corporation first; only then may the purchase own the cursor.
  expect(await playQueueCard(page, corporation),
    `${corporation} never left the deployment queue`).toBeTruthy();
  await expect(payCard, 'reached the project-payment beat').toBeVisible({timeout: 8000});
  await waitQueueIdle(page);
  for (let hop = 0; hop < 8 && await page.locator('.con-start__buy--focused').count() === 0; hop++) {
    await key(page, 'ArrowRight', 260);
  }
  await expect(page.locator('.con-start__buy--focused'),
    'the project-payment beat owns the queue cursor').toBeVisible({timeout: 8000});
}

/** The deployment queue briefly guards input after ownership changes. Profiles
 *  settle on slightly different frames, so prove that A fired the PAY beat and
 *  retry only while the same focused buy block is still waiting for it. */
async function triggerPay(page: Page, deliveryStarted: () => Promise<boolean>, label: string): Promise<void> {
  const pay = page.locator('.con-start__buy');
  const focusedPay = page.locator('.con-start__buy--focused');
  const accepted = async (): Promise<boolean> =>
    await deliveryStarted() || !(await pay.isVisible().catch(() => false));
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.keyboard.press('Enter');
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) {
      if (await accepted()) {
        return;
      }
      await page.waitForTimeout(80);
    }

    // An accepted submit drops the focus before the server response removes
    // PAY. Follow that transition instead of mistaking it for a lost press.
    if (!(await focusedPay.isVisible().catch(() => false))) {
      const transitionDeadline = Date.now() + 4_000;
      while (Date.now() < transitionDeadline) {
        if (await accepted()) {
          return;
        }
        if (await focusedPay.isVisible().catch(() => false)) {
          break;
        }
        await page.waitForTimeout(80);
      }
    }
    expect(await focusedPay.isVisible().catch(() => false),
      `${label}: PAY neither completed nor returned to an actionable focus`).toBeTruthy();
  }
  expect(await accepted(), `${label}: PAY never started the delivery`).toBeTruthy();
}

test.describe('hand delivery · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('delivery fires at the PAY beat: face-up cards fly in, withheld until they land', async ({page, request}) => {
    test.setTimeout(240_000);
    const corporation = await toSummary(page, request);

    // Summary: NO placeholder ghost, dock empty (bought cards not yet paid).
    await expect(page.locator('.con-handdock__ghost')).toHaveCount(0);
    await shoot(page, '01-summary-empty-dock');

    await toPayStep(page, corporation);

    // The payment element shows the bought cards FACE UP (the compact grid).
    const faceUp = page.locator('.con-start__buycard[data-pay-card]');
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
    const flight = page.locator('.con-handdelivery-layer .con-deal-proxy');
    await triggerPay(page, async () => await flight.count() > 0, 'standard delivery');
    await expect(flight.first()).toBeVisible();
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
    const corporation = await toSummary(page, request);
    await toPayStep(page, corporation);
    // Held before the pay press even under reduced motion.
    expect(await page.locator('.con-handdock__card--held').count()).toBeGreaterThan(0);
    const held = page.locator('.con-handdock__card--held');
    await triggerPay(page, async () => await held.count() === 0, 'reduced-motion delivery');
    // No flight; the cards are simply there, no stuck hold.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await expect(held).toHaveCount(0);
    expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    await shoot(page, '05-reduced-delivered');
  });
});

test.describe('hand delivery · tv 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('tv profile: the delivery plays at the pay beat and settles', async ({page, request}) => {
    test.setTimeout(240_000);
    const corporation = await toSummary(page, request, '&consoleProfile=tv');
    await toPayStep(page, corporation);
    await expect(page.locator('.con-start__buycard[data-pay-card]').first()).toBeVisible({timeout: 4000});
    const flight = page.locator('.con-handdelivery-layer .con-deal-proxy');
    await triggerPay(page, async () => await flight.count() > 0, 'tv delivery');
    await expect(flight.first()).toBeVisible();
    await shoot(page, '06-tv-mid-delivery');
    await page.waitForTimeout(3000);
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    await shoot(page, '07-tv-delivered');
  });
});
