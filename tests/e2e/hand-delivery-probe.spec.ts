import {test, expect, APIRequestContext, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {createGameWithCards, fillPicks, openConsole, pickCards, playQueueCard, pressUntil, submitSummary, waitQueueIdle, walkToSummary} from './consoleStart';
import {armWitness} from './witness';

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
  await pressUntil(page, 'ArrowRight', async () => await page.locator('.con-start__buy--focused').count() > 0, {tries: 8, settleMs: 260});
  await expect(page.locator('.con-start__buy--focused'),
    'the project-payment beat owns the queue cursor').toBeVisible({timeout: 8000});
}

/** One frame of the delivery: every hand body (held? — and once released, its centre's offset from its proxy's,
 *  -1 with no proxy at all), the dock counter, the proxies in flight. A page reader — self-contained. */
function handoffFrame(): {bodies: Array<{name: string, held: boolean, off: number | null}>, total: string, flying: number} {
  const bodies = Array.from(document.querySelectorAll<HTMLElement>('.con-handbody[data-hand-dock-card]')).map((el) => {
    const name = el.getAttribute('data-hand-dock-card') ?? '';
    const held = el.classList.contains('con-handbody--held');
    if (held) {
      return {name, held, off: null};
    }
    const proxy = document.querySelector<HTMLElement>(`.con-handdelivery-layer [data-delivery-card="${CSS.escape(name)}"]`);
    if (proxy === null) {
      return {name, held, off: -1};
    }
    const b = el.getBoundingClientRect();
    const p = proxy.getBoundingClientRect();
    const off = Math.hypot((b.left + b.width / 2) - (p.left + p.width / 2), (b.top + b.height / 2) - (p.top + p.height / 2));
    return {name, held, off: Math.round(off * 10) / 10};
  });
  return {
    bodies,
    total: (document.querySelector('.con-handdock__num--total')?.textContent ?? '').trim(),
    flying: document.querySelectorAll('.con-handdelivery-layer .con-deal-proxy').length,
  };
}

/** The RELEASE edges of the record (a body held in one frame, released in the next) — each with its offset then and the
 *  index of the frame it happened in. */
function releasesOf(frames: ReadonlyArray<ReturnType<typeof handoffFrame>>): Array<{name: string, off: number, at: number}> {
  const wasHeld = new Map<string, boolean>();
  const out: Array<{name: string, off: number, at: number}> = [];
  frames.forEach((frame, at) => {
    for (const body of frame.bodies) {
      if (wasHeld.get(body.name) === true && !body.held) {
        out.push({name: body.name, off: body.off ?? -1, at});
      }
      wasHeld.set(body.name, body.held);
    }
  });
  return out;
}

/** The deployment queue briefly guards input after ownership changes. Profiles
 *  settle on slightly different frames, so prove that A fired the PAY beat and
 *  retry only while the same focused buy block is still waiting for it. */
async function triggerPay(page: Page, deliveryStarted: () => Promise<boolean>, label: string): Promise<void> {
  const pay = page.locator('.con-start__buy');
  const focusedPay = page.locator('.con-start__buy--focused');
  const accepted = async (): Promise<boolean> =>
    await deliveryStarted() || !(await pay.isVisible().catch(() => false));
  const focused = async (): Promise<boolean> => await focusedPay.isVisible().catch(() => false);
  /** Did `pred` come true within `ms`? (A poll of the state, never a sleep.) */
  const within = (ms: number, pred: () => Promise<boolean>): Promise<boolean> =>
    expect.poll(pred, {timeout: ms, intervals: [80]}).toBe(true).then(() => true, () => false);
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.keyboard.press('Enter');
    if (await within(4_000, accepted)) {
      return;
    }

    // An accepted submit drops the focus before the server response removes
    // PAY. Follow that transition instead of mistaking it for a lost press.
    if (!await focused()) {
      await within(4_000, async () => await accepted() || await focused());
      if (await accepted()) {
        return;
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

    // Summary: NO placeholder in the tray, dock empty (bought cards not yet paid).
    await expect(page.locator('.con-handdock__pack > *')).toHaveCount(0);
    await shoot(page, '01-summary-empty-dock');

    await toPayStep(page, corporation);

    // The payment element shows the bought cards FACE UP (the compact grid).
    const faceUp = page.locator('.con-start__buycard[data-pay-card]');
    await expect.poll(() => faceUp.count(), {message: 'bought cards shown face-up in the payment grid'}).toBeGreaterThan(0);
    const boughtCount = await faceUp.count();
    // The cards are HELD out of the dock — never in hand before payment.
    await expect(page.locator('.con-handdock__num--total').first(), 'dock counter withheld before payment').toHaveText('0');
    await expect.poll(() => page.locator('.con-handbody--held').count(), {message: 'cards laid out but held'}).toBeGreaterThan(0);
    // No flight yet — the delivery fires ONLY on the pay press.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await shoot(page, '02-pay-step-faceup');

    // THE SEAMLESS-HANDOFF WITNESS, armed BEFORE the pay press (an order
    // claim cannot be sampled late): on every `--held` release the body
    // must stand EXACTLY under its proxy — the intake targets the bodies
    // layer's analytic pose (tilt included), so the materialization is
    // pixel-true by construction. A regression here is the v1 rect-vs-pose
    // mismatch (or the «карты испаряются» degrade, which releases with NO
    // proxy at all — recorded as offset -1). A RECORDING (`armWitness` — the
    // observer samples in the very task the release is written, as the old
    // hand-rolled observer did): every body's held state, its offset from its
    // proxy once released, the dock counter and the proxies in flight.
    const delivery = await armWitness(page, 'hand-delivery', handoffFrame, {max: 20_000});

    // PAY → the face-up cards fly from the grid into the dock.
    const flight = page.locator('.con-handdelivery-layer .con-deal-proxy');
    await triggerPay(page, async () => await flight.count() > 0, 'standard delivery');
    await expect(flight.first()).toBeVisible();
    // Face → back flip proxies (each carries a face).
    await expect.poll(() => page.locator('.con-handdelivery-layer .con-deal-proxy__face').count()).toBeGreaterThan(0);
    await shoot(page, '03-mid-delivery');

    // Settle: the END state — proxies gone (within the old 3 s pause + the locator's own 5 s), cards materialized,
    // counter caught up to N (≥1).
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0, {timeout: 8_000});
    await expect(page.locator('.con-handbody--held')).toHaveCount(0);
    await expect.poll(() => page.locator('.con-handbody').count(), {message: 'cards materialized in the dock'}).toBeGreaterThanOrEqual(boughtCount);
    const delivered = await page.locator('.con-handbody').count();
    await expect(page.locator('.con-handdock__num--total').first(), 'counter reached the delivered total').toHaveText(String(delivered));
    // Still withheld while flying — the counter has not jumped ahead: in EVERY recorded frame of the flight before the
    // first card materialized, the counter reads 0 (the record, never one read that a slow frame lands after a landing).
    const frames = await delivery.values();
    const releases = releasesOf(frames);
    const flyingBeforeAnyRelease = frames.slice(0, releases[0]?.at ?? frames.length).filter((f) => f.flying > 0);
    expect(flyingBeforeAnyRelease.length, 'the flight was recorded before its first landing').toBeGreaterThan(0);
    expect([...new Set(flyingBeforeAnyRelease.map((f) => f.total))], 'counter withheld during flight').toEqual(['0']);
    // THE HANDOFF LAW: every release happened UNDER its proxy, on the pose.
    const handoffs = releases.map(({name, off}) => ({name, off}));
    console.log(`[delivery] handoffs=${JSON.stringify(handoffs)}`);
    expect(handoffs.length, 'the release edge was witnessed').toBeGreaterThan(0);
    const badHandoffs = handoffs.filter((r) => r.off < 0 || r.off > 4);
    expect(badHandoffs, `a card materialized OFF its proxy (or with no proxy at all):\n  ${JSON.stringify(badHandoffs)}`).toEqual([]);
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
    await expect.poll(() => page.locator('.con-handbody--held').count()).toBeGreaterThan(0);
    const held = page.locator('.con-handbody--held');
    await triggerPay(page, async () => await held.count() === 0, 'reduced-motion delivery');
    // No flight; the cards are simply there, no stuck hold.
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0);
    await expect(held).toHaveCount(0);
    await expect.poll(() => page.locator('.con-handbody').count()).toBeGreaterThan(0);
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
    // The END state — the proxies gone (within the old 3 s pause + the locator's own 5 s).
    await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0, {timeout: 8_000});
    await expect.poll(() => page.locator('.con-handbody').count()).toBeGreaterThan(0);
    await shoot(page, '07-tv-delivered');
  });
});
