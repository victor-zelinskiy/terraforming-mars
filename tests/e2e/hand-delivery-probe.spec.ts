import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * HAND DELIVERY probe — the starting-cards delivery cinematic
 * (handDeliveryDirector.ts) + the empty-tray cleanup.
 *
 * Verifies:
 *  - the 0-cards dock has NO placeholder ghost;
 *  - the bought project cards are WITHHELD from the dock at buy time (the
 *    counter stays 0 while they fly — never shown before payment lands);
 *  - the delivery proxies fly, then the cards materialize and the counter
 *    ticks up to N;
 *  - reduced motion: no proxies, cards still arrive (instant, connected).
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

/** Walk the wizard to the summary and buy `buyProjects`, WITHOUT the final
 *  submit — the caller presses Period once more to submit and observe. */
async function toSummary(page: Page, request: any, buyProjects: number, profileQuery = ''): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok()).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  // ADAPTIVE wizard walk — the prelude / project layouts differ by profile
  // (strip vs grid) and by reduced-motion, so a fixed key sequence drifts.
  // Instead, drive to the summary generically: each round PICKS the focused
  // card, MOVES on, and TRIES to continue (RT advances only when the step
  // is complete — corp auto-advances on A). Stops the moment the launch CTA
  // «НАЧАТЬ ПАРТИЮ» appears (never pressing A on the summary). At least one
  // project is bought on the projects step (A buys, RT advances). `buyProjects`
  // is unused now — kept for call-site intent.
  void buyProjects;
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
  // fly): the adaptive walk can reach the summary with a zero buy on some
  // grid layouts. If so, step BACK to the projects (LB) and buy the focused
  // card(s) explicitly, then return to the summary.
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

test.describe('hand delivery · standard 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('no ghost at 0 cards; bought cards fly in and are withheld until they land', async ({page, request}) => {
    test.setTimeout(240_000);
    await toSummary(page, request, 3);

    // 0-cards state during the wizard: NO placeholder ghost, counter 0.
    await expect(page.locator('.con-handdock__ghost')).toHaveCount(0);
    await expect(page.locator('.con-handdock__card')).toHaveCount(0);
    await shoot(page, '01-summary-empty-dock');

    // Submit the buy (the payment) — the summary launch is A (Enter); RT
    // deliberately does NOT fire the start. The delivery arms + fires.
    await page.keyboard.press('Enter');
    // The paid cards must NOT appear in the dock immediately — they are held
    // (hidden + excluded from the count) while the proxies fly in.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy').first()).toBeVisible({timeout: 3000});
    const totalDuringFlight = (await page.locator('.con-handdock__num--total').first().textContent())?.trim();
    expect(totalDuringFlight, 'counter withheld during flight').toBe('0');
    // Held cards are laid out but hidden (visibility), the reveal proxies carry them.
    expect(await page.locator('.con-handdock__card--held').count()).toBeGreaterThan(0);
    await shoot(page, '02-mid-delivery');

    // Settle: proxies gone, cards materialized, counter caught up to N (≥1).
    await page.waitForTimeout(2200);
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-handdock__card--held')).toHaveCount(0);
    const delivered = await page.locator('.con-handdock__card').count();
    expect(delivered, 'cards materialized in the dock').toBeGreaterThan(0);
    const totalAfter = (await page.locator('.con-handdock__num--total').first().textContent())?.trim();
    expect(totalAfter, 'counter reached the delivered total').toBe(String(delivered));
    await shoot(page, '03-delivered');
  });
});

test.describe('hand delivery · reduced motion', () => {
  test.use({
    viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080}, reducedMotion: 'reduce',
  });

  test('no proxies — the bought cards still arrive (instant, connected)', async ({page, request}) => {
    test.setTimeout(240_000);
    await toSummary(page, request, 2);
    await expect(page.locator('.con-handdock__ghost')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    // No flight; the cards are simply there, no stuck hold.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await expect(page.locator('.con-handdock__card--held')).toHaveCount(0);
    expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    await shoot(page, '04-reduced-delivered');
  });
});

test.describe('hand delivery · tv 1080', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('tv profile: the delivery plays and settles', async ({page, request}) => {
    test.setTimeout(240_000);
    await toSummary(page, request, 3, '&consoleProfile=tv');
    await page.keyboard.press('Enter');
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy').first()).toBeVisible({timeout: 3000});
    await shoot(page, '05-tv-mid-delivery');
    await page.waitForTimeout(2200);
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    expect(await page.locator('.con-handdock__card').count()).toBeGreaterThan(0);
    await shoot(page, '06-tv-delivered');
  });
});
