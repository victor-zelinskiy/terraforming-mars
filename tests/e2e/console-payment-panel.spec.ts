import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, openQuickWheel} from './consoleStart';

/**
 * CONSOLE PAYMENT — the compact summary and the expanded editor are ONE block.
 *
 * The two claims a unit test cannot make are made here, against the real
 * rendered shell:
 *
 *  1. LT does not open another screen — the card, the header, the result and
 *     the CTA all keep their pixel position; only the payment block's density
 *     changes.
 *  2. An appearing / disappearing OVERPAY does not move the CTA. This is the
 *     bug the rework exists for: the payment block's height must be constant
 *     for a given prompt, whatever the mix.
 *
 * The frames land in `screenshots/console-payment/` for couch review.
 */

const OUT = path.resolve('screenshots', 'console-payment');

function cfg() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'PayTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false, fastModeOption: false,
    showOtherPlayersVP: false, testMode: true, aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false,
    initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    // HELION on purpose: heat pays for ANYTHING, so every card in hand has an
    // alternative payment source. Without it the deal is random and the walk
    // below sometimes finds only M€-only cards — a flaky SETUP, not a flaky
    // assertion, but a flaky spec either way.
    startingCorporations: 1, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: ['Helion'], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

/**
 * The display profile under test. Defaults to 1080p; a reviewer re-runs the
 * SAME contract on the couch or the handheld with
 *   PAY_E2E_PROFILE=tv-4k npx playwright test tests/e2e/console-payment-panel.spec.ts
 * (the 4K walk is markedly slower, which is why it is not the default).
 */
const PROFILES: Record<string, {width: number, height: number}> = {
  'standard-1080': {width: 1920, height: 1080},
  'tv-4k': {width: 3840, height: 2160},
  'deck-handheld': {width: 1280, height: 800},
};
const PROFILE_ID = process.env.PAY_E2E_PROFILE ?? 'standard-1080';
const VIEWPORT = PROFILES[PROFILE_ID] ?? PROFILES['standard-1080'];

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PROFILE_ID}-${name}.png`)});
}
async function key(page: Page, code: string, settle = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}
/** The CTA's viewport box — the thing that must never move. */
async function ctaBox(page: Page) {
  const box = await page.locator('.con-composer__cta').first().boundingBox();
  expect(box, 'the play CTA is not rendered').not.toBeNull();
  return box!;
}

/**
 * Reach the play-card composer of a card whose payment offers an ALTERNATIVE
 * source (the only case with a quick-adjust and an editor to prove). Shared by
 * the contract test and the display-profile capture below.
 */
async function reachConfigurablePayment(page: Page, request: APIRequestContext): Promise<void> {
  // Pregame is SETUP, not this spec's subject. Use the shared API-backed road
  // and name Helion explicitly: testMode guarantees it is offered but does not
  // narrow the eight-card corporation deal to it.
  await bootIntoGame(page, request, {config: cfg(), corporation: 'Helion', buy: 5});

  await openQuickWheel(page);
  const hand = page.locator('.con-hand');
  for (let i = 0; i < 4 && await hand.count() === 0; i++) {
    await key(page, 'Enter', 1400);
  }
  expect(await hand.count(), 'never reached the hand').toBeGreaterThan(0);
  await page.locator('.con-hand:not(.con-hand--transit)')
    .waitFor({state: 'visible', timeout: 15_000});

  // The hand orders PLAYABLE cards first, and Helion gives every card a heat
  // lane — so the focused card is always both playable and configurable. No
  // walking, no guessing: open the composer on it and wait for the preview.
  for (let i = 0; i < 4 && await page.locator('.con-composer--play').count() === 0; i++) {
    await key(page, 'Enter', 1400);
  }
  expect(await page.locator('.con-composer--play').count(), 'never opened the play composer').toBeGreaterThan(0);
  // The payment panel only exists once the play PREVIEW has landed — the
  // composer renders a loading line until then, so poll rather than sleep.
  await page.waitForSelector('.con-pay', {timeout: 20_000});
  const configurable = await page.locator('.con-pay--configurable').count() > 0;
  expect(configurable, 'no hand card offered an alternative payment source').toBeTruthy();
}

test.describe(`console payment — one block, two densities · ${PROFILE_ID}`, () => {
  test.use({viewport: VIEWPORT, deviceScaleFactor: 1, screen: VIEWPORT});

  test('compact ⇄ expanded keep the layout, and overpay never moves the CTA', async ({page, request}) => {
    test.setTimeout(300_000);
    // Fail FAST and readably: without this an unexpectedly-unmounted surface
    // makes an auto-waiting locator hang until the whole test times out, which
    // hides the real cause behind «Test timeout exceeded».
    page.setDefaultTimeout(15_000);
    await reachConfigurablePayment(page, request);

    // ── COMPACT ────────────────────────────────────────────────────────
    await shoot(page, '01-compact');
    const pay = page.locator('.con-pay');
    expect(await pay.count()).toBe(1);
    // Every source row + the verdict are present in the compact summary.
    expect(await page.locator('.con-payrow').count()).toBeGreaterThan(1);
    expect(await page.locator('.con-paystatus').count()).toBe(1);
    // The auto M€ lane is always rendered, badged, and never dialable.
    expect(await page.locator('.con-payrow[data-pay-unit="megacredits"] .con-payrow__auto').count()).toBe(1);
    // A single-alt payment wears the bumper pills right on its row; a multi-lane
    // one is editor-only by design (the bumpers would be ambiguous).
    const quickAdjustable = await page.locator('.con-payrow--dial .con-payrow__pills').count() === 1;

    const compactRows = await page.locator('.con-payrow').count();
    const compactCta = await ctaBox(page);
    const compactCard = (await page.locator('.con-composer__playcard').boundingBox())!;
    const compactPayTop = (await pay.boundingBox())!.y;

    // ── THE LAYOUT-SHIFT CONTRACT: dial the alt source and watch the CTA ──
    // Walk the whole dial range; the CTA must not move by a single pixel at
    // any point, including across the exact ⇄ overpay ⇄ shortfall flips.
    const seenVerdicts = new Set<string>();
    const statusHeights = new Set<number>();
    const recordState = async () => {
      const cls = await page.locator('.con-paystatus').getAttribute('class') ?? '';
      for (const kind of ['exact', 'overpay', 'short', 'free', 'auto', 'impossible']) {
        if (cls.includes(`con-paystatus--${kind}`)) {
          seenVerdicts.add(kind);
        }
      }
      statusHeights.add((await page.locator('.con-paystatus').boundingBox())!.height);
    };
    await recordState();
    if (quickAdjustable) {
      for (let i = 0; i < 6; i++) {
        await key(page, 'KeyE', 320); // RB = +1 of the alt source
        await recordState();
        expect(await ctaBox(page), `CTA moved after +1 #${i}`).toEqual(compactCta);
        expect(await page.locator('.con-payrow').count(), 'a row appeared/vanished').toBe(compactRows);
      }
      await shoot(page, '02-compact-dialed-up');
      for (let i = 0; i < 10; i++) {
        await key(page, 'KeyQ', 320); // LB = −1, down through the whole range
        await recordState();
        expect(await ctaBox(page), `CTA moved after −1 #${i}`).toEqual(compactCta);
        expect(await page.locator('.con-payrow').count(), 'a row appeared/vanished').toBe(compactRows);
      }
      await shoot(page, '03-compact-dialed-down');
    }
    // The verdict block reserves ONE height for every state it can enter — the
    // exact ⇄ overpay ⇄ shortfall flip is what used to resize the panel.
    // (Which verdicts a given deal can reach depends on the card's cost and the
    // resource rate; the flip itself is asserted pixel-exactly in
    // tests/client/components/console/consolePaymentPanel.spec.ts.)
    expect([...statusHeights], `verdicts crossed: ${[...seenVerdicts].join(',')}`).toHaveLength(1);

    // ── EXPANDED (LT) — the SAME block, opened ─────────────────────────
    await key(page, 'Comma', 900);
    expect(await page.locator('.con-pay--expanded').count(), 'LT did not expand the payment block').toBe(1);
    await shoot(page, '04-expanded');

    // The card, the CTA and the block itself stay exactly where they were —
    // this is what makes it read as an unfolding, not a new screen.
    expect(await ctaBox(page), 'the CTA moved on expand').toEqual(compactCta);
    expect((await page.locator('.con-composer__playcard').boundingBox())!).toEqual(compactCard);
    expect((await page.locator('.con-pay').boundingBox())!.y).toEqual(compactPayTop);
    // Same rows, same order; the cursor opens on the source the bumpers drove.
    expect(await page.locator('.con-payrow').count()).toBe(compactRows);
    expect(await page.locator('.con-payrow--focused').count()).toBe(1);
    // The expanded density spells the captions out (the only added content).
    const capsVisible = await page.locator('.con-payrow__cap').first().isVisible();
    expect(capsVisible, 'expanded did not reveal the micro captions').toBeTruthy();

    // Dialing inside the editor is the same mutation, same stability.
    for (let i = 0; i < 4; i++) {
      await key(page, 'KeyE', 320);
      expect(await ctaBox(page), `CTA moved in the editor #${i}`).toEqual(compactCta);
    }
    await shoot(page, '05-expanded-dialed');
    // Remember WHICH source was edited (the focused one) — a multi-lane payment
    // is editor-only, so there is no compact «dial» row to read it back from.
    const editedUnit = await page.locator('.con-payrow--focused').getAttribute('data-pay-unit');
    const editedUsed = await page.locator('.con-payrow--focused .con-payrow__used').innerText();

    // ── BACK — the mix survives the fold ───────────────────────────────
    await key(page, 'Comma', 900);
    expect(await page.locator('.con-pay--compact').count(), 'LT did not fold the block back').toBe(1);
    expect(await ctaBox(page), 'the CTA moved on collapse').toEqual(compactCta);
    expect(await page.locator(`.con-payrow[data-pay-unit="${editedUnit}"] .con-payrow__used`).innerText(),
      'the mix chosen in the editor did not survive the fold back').toBe(editedUsed);
    await shoot(page, '06-back-to-compact');
  });
});
